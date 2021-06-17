module.exports = {
  apps: [{
    name: 'project-cuys01',
    script: './src/index.js',
    node_args: '--require dotenv/config',
    watch: false
  }
  ],
};
