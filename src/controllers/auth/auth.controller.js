/**
 * Auth controller — thin translation layer between HTTP and the auth service.
 *
 * Every response uses the shared envelope and the session token is delivered
 * as an httpOnly cookie (plus in the body for Bearer-based API clients).
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const authService = require('../../services/auth/auth.service');
const emailService = require('../../services/email/email.service');
const notificationService = require('../../services/notifications/notification.service');
const logger = require('../../utils/logger');
const { signToken, setSessionCookie, clearSessionCookie } = require('../../utils/token');

/** Signs the access token — only the identity needed by the middleware. */
const issueToken = (user) =>
  signToken({
    sub: user.id,
    schoolId: user.schoolId,
    role: user.role,
    panel: user.panel,
  });

/** The payload shared by register / login / me. */
async function sessionPayload(session) {
  return {
    user: await authService.serializeUser(session.user, session.school, session.subscription),
  };
}

const register = asyncHandler(async (req, res) => {
  const session = await authService.registerSchool(req.body);
  const token = issueToken(session.user);
  setSessionCookie(res, token);

  // Welcome email (Resend / BisonsTechs branding) + in-app notification — best-effort.
  Promise.all([
    emailService.sendWelcomeEmail({
      to: session.user.email,
      name: session.user.name,
      schoolName: session.school.name,
      schoolId: session.school.id,
      userId: session.user.id,
    }),
    notificationService.createNotification({
      schoolId: session.school.id,
      userId: session.user.id,
      title: 'Welcome to BisonsEduCore360',
      message: `Your school "${session.school.name}" is ready. Start by adding classes and students.`,
      icon: 'system',
      tone: 'blue',
      href: '/dashboard',
    }),
  ]).catch((err) => {
    logger.warn(`Post-register welcome side-effects failed: ${err.message}`);
  });

  return ApiResponse.created(
    res,
    'Your school has been registered. Your free trial has started.',
    { token, ...(await sessionPayload(session)) }
  );
});

const login = asyncHandler(async (req, res) => {
  const session = await authService.login({
    email: req.body.email,
    password: req.body.password,
  });
  const token = issueToken(session.user);

  // "Remember me" unchecked (`remember: false`) → session cookie, so the user is
  // signed out as soon as the browser closes. Anything else keeps it for 30 days.
  setSessionCookie(res, token, {
    maxAgeDays: req.body.remember === false ? null : undefined,
  });

  return ApiResponse.ok(res, 'Signed in successfully.', {
    token,
    ...(await sessionPayload(session)),
  });
});

/** Validates the current session and returns the fresh user + subscription. */
const me = asyncHandler(async (req, res) => {
  const session = await authService.getSession(req.auth.userId);
  return ApiResponse.ok(res, 'Session is valid.', await sessionPayload(session));
});

/** Update the current user's profile (name, phone, etc.). */
const updateProfile = asyncHandler(async (req, res) => {
  await authService.updateProfile(req.auth.userId, req.body || {});
  const session = await authService.getSession(req.auth.userId);
  return ApiResponse.ok(res, 'Profile updated successfully.', await sessionPayload(session));
});

const logout = asyncHandler(async (req, res) => {
  clearSessionCookie(res);
  return ApiResponse.ok(res, 'Signed out successfully.', { loggedOut: true });
});

module.exports = { register, login, me, updateProfile, logout };
