if (!process.env.npm_config_user_agent?.includes('pnpm')) {
  console.error('\u001b[31mThis project must be run with pnpm.\u001b[0m');
  process.exit(1);
}
