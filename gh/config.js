/* GoHawaii backend switch. Empty = review build: posts, places and sign-in stay in each browser,
 * and nothing is counted. Set api to the deployed gohawaii-api Worker (backend-gohawaii/README.md)
 * and the Dashboard signs staff in, every browser shares posts and place changes, and the app sends
 * visit totals. One line; nothing else changes. */
window.GH_CONFIG = { api: 'https://gohawaii-api.oceansafe-hi.workers.dev' };
