/**
 * Platform admin controller — login + schools overview.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const env = require('../../config/env');
const { signToken, cookieOptions } = require('../../utils/token');
const platformAuth = require('../../services/platform/platform-auth.service');
const platformSchools = require('../../services/platform/platform-schools.service');

function setPlatformCookie(res, token, { maxAgeDays = 30 } = {}) {
  const options = {
    ...cookieOptions(),
    ...(maxAgeDays !== null ? { maxAge: maxAgeDays * 24 * 60 * 60 * 1000 } : {}),
  };
  res.cookie(env.platform.cookieName, token, options);
}

function clearPlatformCookie(res) {
  res.clearCookie(env.platform.cookieName, cookieOptions());
}

function issuePlatformToken(admin) {
  return signToken({
    sub: admin.email,
    kind: 'platform',
    name: admin.name,
    role: admin.role,
  });
}

const login = asyncHandler(async (req, res) => {
  const session = platformAuth.login({
    email: req.body.email,
    password: req.body.password,
  });
  const token = issuePlatformToken(session.admin);
  setPlatformCookie(res, token, {
    maxAgeDays: req.body.remember === false ? null : undefined,
  });
  return ApiResponse.ok(res, 'Signed in successfully.', {
    token,
    admin: session.admin,
  });
});

const me = asyncHandler(async (req, res) => {
  const session = platformAuth.me(req.platformAuth.email);
  return ApiResponse.ok(res, 'Session loaded.', { admin: session.admin });
});

const logout = asyncHandler(async (req, res) => {
  clearPlatformCookie(res);
  return ApiResponse.ok(res, 'Signed out.', { loggedOut: true });
});

const dashboard = asyncHandler(async (req, res) => {
  const data = await platformSchools.dashboardStats();
  return ApiResponse.ok(res, 'Platform dashboard.', data);
});

const listSchools = asyncHandler(async (req, res) => {
  const data = await platformSchools.listSchools({ q: req.query.q });
  return ApiResponse.ok(res, 'Registered schools.', data);
});

const getSchool = asyncHandler(async (req, res) => {
  const data = await platformSchools.getSchool(req.params.id);
  return ApiResponse.ok(res, 'School details.', data);
});

const setSchoolActive = asyncHandler(async (req, res) => {
  const isActive = req.body?.isActive;
  const data = await platformSchools.setSchoolActive(req.params.id, isActive);
  return ApiResponse.ok(
    res,
    isActive ? 'School activated.' : 'School deactivated.',
    data
  );
});

const extendTrial = asyncHandler(async (req, res) => {
  const days = req.body?.days ?? 5;
  const data = await platformSchools.extendTrial(req.params.id, days);
  return ApiResponse.ok(res, `Trial extended by ${days} day(s).`, data);
});

const setPlan = asyncHandler(async (req, res) => {
  const plan = req.body?.plan;
  const data = await platformSchools.setPlan(req.params.id, plan);
  return ApiResponse.ok(res, `Plan set to ${String(plan).toUpperCase()}.`, data);
});

const setAdmissionForm = asyncHandler(async (req, res) => {
  const enabled = req.body?.enabled;
  const data = await platformSchools.setAdmissionForm(req.params.id, enabled);
  return ApiResponse.ok(
    res,
    enabled ? 'A+ admission form enabled.' : 'Standard admission form restored.',
    data
  );
});

module.exports = {
  login,
  me,
  logout,
  dashboard,
  listSchools,
  getSchool,
  setSchoolActive,
  extendTrial,
  setPlan,
  setAdmissionForm,
};
