const chalk = require('chalk'),
      config = require('./config/config'),
      isJSON = require('is-valid-json'),
      strftime = require('strftime').timezone('+0800'),
      unicom = require('./lib/10010.js');
var users = Buffer.from(process.env.data || 'e30=', 'base64').toString('utf8');

var worker = async (users, config) => {
  try {
    if ('unicom' in users) {
      if (users.unicom.length > 0) {
        console.time('聯通任務時間');
        console.log(chalk.rgb(184,121,255)('%s 開始聯通簽到任務'), strftime('[%F %T]'));
        await unicom.worker(users.unicom, config.unicom.userAgent, config.unicom.timeout, config.unicom.retry);
        console.log(chalk.rgb(184,121,255)('%s 結束聯通簽到任務'), strftime('[%F %T]'));
        console.timeEnd('聯通任務時間');
      } else {
        console.log(chalk.rgb(249,38,114)('%s 找不到聯通帳號資料!'), strftime('[%F %T]'));
      }
    }
  } catch (error) {
    console.log(chalk.rgb(249,38,114)('%s 進行任務失敗: %s'), strftime('[%F %T]'), error);
  }
}

if (isJSON(users)) {
  users = JSON.parse(users);
  worker(users, config);
} else {
  console.log(chalk.rgb(249,38,114)('%s 找不到任何帳號資料!'), strftime('[%F %T]'));
  return;
}
