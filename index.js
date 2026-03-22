const app = require("./app");

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API running on http://localhost:${PORT}`);
    console.log(`Mobile access: http://192.168.1.176:${PORT}`);
  });
}

module.exports = app;
