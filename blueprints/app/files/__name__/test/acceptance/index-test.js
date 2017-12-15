import { appAcceptanceTest } from 'denali';

const test = appAcceptanceTest();

test('GET / > should return a welcome message', async (t) => {
  let { body } = await t.context.app.get('/');
  t.is(body.message, 'Welcome to Denali!');
});
