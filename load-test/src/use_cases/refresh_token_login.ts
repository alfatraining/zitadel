import { loginByUsernamePassword } from '../login_ui';
import { loginByRefreshToken } from '../oidc';
import { createOrg, removeOrg } from '../org';
import { User, createHuman } from '../user';
import { Trend } from 'k6/metrics';
import { Config, MaxVUs } from '../config';

export async function setup() {
  const tokens = loginByUsernamePassword(Config.admin as User);
  console.log('setup: admin signed in');

  const org = await createOrg(tokens.accessToken!);
  console.log(`setup: org (${org.organizationId}) created`);

  const humanPromises = Array.from({ length: MaxVUs() }, (_, i) => {
    return createHuman(`zitizen-${i}`, org, tokens.accessToken!);
  });

  const humans = (await Promise.all(humanPromises)).map((user) => {
    return { userId: user.userId, loginName: user.loginNames[0], password: 'Password1!' };
  });
  console.log(`setup: ${humans.length} users created`);

  const tokenPromises = Array.from(humans, (user, _) => {
    return loginByUsernamePassword(user, true);
  });
  const refreshTokens = (await Promise.all(tokenPromises)).map((token) => {
    return token.refreshToken;
  });
  console.log(`setup: ${refreshTokens.length} refresh tokens created`);

  return { tokens, org, refreshTokens: refreshTokens };
}

const refreshTokenLoginTrend = new Trend('human_password_login_duration', true);
export default function (data: any) {
  const start = new Date();
  const token = loginByRefreshToken(data.refreshTokens[__VU - 1]);
  data.refreshTokens[__VU - 1] = token.refreshToken;

  refreshTokenLoginTrend.add(new Date().getTime() - start.getTime());
}

export function teardown(data: any) {
  removeOrg(data.org, data.tokens.accessToken);
}
