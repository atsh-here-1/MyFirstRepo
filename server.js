const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Frontend server listening at http://localhost:${port}`);
});
