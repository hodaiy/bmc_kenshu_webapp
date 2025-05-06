const db = require('./db');

(async () => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log(rows); // [{ result: 2 }]
    console.log('✅ DB接続成功！');
  } catch (err) {
    console.error('❌ 接続エラー:', err);
  }
})();
