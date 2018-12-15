const chalk = require('chalk'),
      delay = require('delay'),
      named = require('named-regexp').named,
      request = require('superagent'),
      rs = require('jsrsasign'),
      strftime = require('strftime').timezone('+0800');

var UNICOM = function() {
  var self = this;

  self.count = 0;
  
  self.pub_key = rs.KEYUTIL.getKey(Buffer.from('LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FEYytDWks5YkJBOUlVK2daVU9jNkZVR3U3eU85V3BUTkIwUHptZ0ZCaDk2TWcxV3JvdkQxb3FaK2VJRjRManZ4S1hHT2RJNzlKUmR2ZTlOUGhRbzA3K3VxR1FnRTRpbXdOblJ4N1BGdENScnlpSUVjVW9hdnVOdHVSVm9CQW02cWRCMFNyY3RnYXFHZkxnS3ZaSE9ud1RqeU5xakJVeHpNZVFsRUMyY3pFTVN3SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==', 'base64').toString('utf8'));
  
  self.pad_randomstr = (text, size = 6) => {
    return text + Math.random().toString().slice(0 - size);
  }

  self.worker = async (users, userAgent, timeout, count) => {
    try {
      self.count = count;
      let promises = users.map(async (user) => {
        if (! ('username' in user) || ! ('password' in user)) {
          return false;
        }
        var mobile = user.username.replace(/(\d{2})\d{7}(\d{2})/, '$1*******$2'),
            username = user.username,
            password = user.password;
        username = Buffer.from(rs.KJUR.crypto.Cipher.encrypt(self.pad_randomstr(username), self.pub_key), 'hex').toString('base64');
        password = Buffer.from(rs.KJUR.crypto.Cipher.encrypt(self.pad_randomstr(password), self.pub_key), 'hex').toString('base64');
        var result = false;
        if ('appId' in user) {
          result = await self.login(mobile, username, password, userAgent, timeout, self.count, user.appId);
        } else {
          result = await self.login(mobile, username, password, userAgent, timeout, self.count);
        }
        if (result) {
          console.log(chalk.rgb(23,255,0)('%s %s 已完成聯通任務!'), strftime('[%F %T]'), mobile);
        } else {
          console.log(chalk.rgb(249,38,114)('%s %s 未能完成聯通任務!'), strftime('[%F %T]'), mobile);
        }
        return result;
      });
      var results = await Promise.all(promises);
      console.log(chalk.rgb(184,121,255)('%s %s'), strftime('[%F %T]'), results);
    } catch (error) {
      console.log(chalk.rgb(249,38,114)('%s 聯通任務發生錯誤: %s'), strftime('[%F %T]'), error);
    }
  }

  self.login = async (mobile, username, password, userAgent, timeout, count, appId = 'f5de6ef07af275406f951e0d55c88ac9ef55aa9491093e3dd2ae70b015edae6d') => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .post(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9tb2JpbGVTZXJ2aWNlL2xvZ2luLmh0bQ==', 'base64').toString('utf8'))
          .set('User-Agent', userAgent)
          .type('form')
          .send({
            version: 'iphone_c@5.71',
            mobile: username,
            netWay: 'wifi',
            isRemberPwd: 'true',
            appId: appId,
            deviceId: '',
            pip: '',
            password: password,
            deviceOS: '11.3',
            deviceBrand: 'iphone',
            deviceModel: 'iPhone',
            keyVersion: 1,
            deviceCode: '000000000000000'
          })
          .timeout({ deadline: timeout });
        if (response.ok) {
          var obj = JSON.parse(response.text);
          if ('code' in obj) {
            if (obj.code == 0 && ('set-cookie' in response.headers)) {
              var cookies = response.headers['set-cookie'].toString(),
                  re = named(/a_token=(:<a_token>[a-zA-Z0-9.\-_]+)/g),
                  matched = re.exec(cookies),
                  token = matched.capture('a_token');
              return await self.querySigninActivity(mobile, token, userAgent, timeout, self.count);
            } else {
              if ('dsc' in obj) {
                console.log(chalk.rgb(249,38,114)('%s %s APP登入失敗: %s'), strftime('[%F %T]'), mobile, obj.dsc);
                return false;
              } else {
                console.log(chalk.rgb(249,38,114)('%s %s APP登入失敗: 找不到Cookies!'), strftime('[%F %T]'), mobile);
                continue;            
              }
            }
          } else {
            console.log(chalk.rgb(184,121,255)('%s %s APP登入失敗! 重試中..'), strftime('[%F %T]'), mobile);
            continue;            
          }
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s APP登入重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試登入失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s APP登入超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.login(mobile, username, password, userAgent, timeout, --count, appId);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 登入失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.querySigninActivity = async (mobile, token, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .get(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9TaWduaW5BcHAvc2lnbmluL3F1ZXJ5U2lnbmluQWN0aXZpdHkuaHRt', 'base64').toString('utf8'))
          .query({
            token: token
          })
          .set('User-Agent', userAgent)
          .timeout({ deadline: timeout });
        if (response.ok) {
          if ('set-cookie' in response.headers) {
            var daySignCookies = response.headers['set-cookie'].toString();
            return await self.daySign(mobile, token, daySignCookies, userAgent, timeout, self.count);
          } else {
            console.log(chalk.rgb(249,38,114)('%s %s 獲取Cookies失敗: 找不到Cookies!'), strftime('[%F %T]'), mobile);
            continue;
          }
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 獲取Cookies重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試獲取Cookies失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 獲取Cookies超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.querySigninActivity(mobile, token, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 獲取Cookies失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.daySign = async (mobile, token, daySignCookies, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .post(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9TaWduaW5BcHAvc2lnbmluL2RheVNpZ24uZG8=', 'base64').toString('utf8'))
          .set('User-Agent', userAgent)
          .set('Cookie', daySignCookies)
          .type('form')
          .send({
            className: 'signinIndex'
          })
          .timeout({ deadline: timeout });
        var r = Math.floor(Math.random() * 3000) + 2000;
        if (response.ok) {
          var obj = JSON.parse(response.text);
          if ('prizeCount' in obj) {
            console.log(chalk.rgb(23,255,0)('%s %s 簽到成功! 獲得金幣: %s'), strftime('[%F %T]'), mobile, obj.prizeCount);
            return self.woTree(mobile, token, userAgent, timeout, self.count);
          } else if ('message' in obj) {
            console.log(chalk.rgb(23,255,0)('%s %s 簽到成功! 信息: %s'), strftime('[%F %T]'), mobile, obj.message);
            return self.woTree(mobile, token, userAgent, timeout, self.count);
          } else if ('loginCode' in obj) {
            console.log(chalk.rgb(249,38,114)('%s %s 簽到登入失敗! 等待 %s 毫秒後重試...'), strftime('[%F %T]'), mobile, r);
            await delay(r);
            continue;
          } else {
            console.log(chalk.rgb(249,38,114)('%s %s 簽到失敗! 等待 %s 毫秒後重試...'), strftime('[%F %T]'), mobile, r);
            await delay(r);
            continue;
          }
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 獲取簽到信息失敗! 等待 %s 毫秒後重試...'), strftime('[%F %T]'), mobile, r);
          await delay(r);
          continue;
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試簽到失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 簽到超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.daySign(mobile, token, daySignCookies, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 簽到失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.woTree = async (mobile, token, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .get(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9tYWN0aXZpdHkvYXJib3JkYXkvaW5kZXg=', 'base64').toString('utf8'))
          .query({
            token: token
          })
          .set('User-Agent', userAgent)
          .timeout({ deadline: timeout });
        if (response.ok) {
          if ('set-cookie' in response.headers) {
            var cookies = response.headers['set-cookie'].toString();
            return await self.waterGrow(mobile, cookies, userAgent, timeout, self.count);
          } else {
            console.log(chalk.rgb(184,121,255)('%s %s 獲取沃之樹頁面失敗! 重試中...'), strftime('[%F %T]'), mobile);
            continue;   
          }
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 獲取沃之樹頁面重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試獲取沃之樹頁面失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 獲取沃之樹頁面超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.woTree(mobile, token, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 獲取沃之樹頁面失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.waterGrow = async (mobile, cookies, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .post(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9tYWN0aXZpdHkvYXJib3JkYXkvYXJib3IvMS8wLzEvZ3Jvdw==', 'base64').toString('utf8'))
          .set('User-Agent', userAgent)
          .set('Cookie', cookies)
          .type('form')
          .timeout({ deadline: timeout });
        if (response.ok) {
          var obj = JSON.parse(response.text);
          if ('addedValue' in obj) {
            // console.log(chalk.rgb(23,255,0)('%s %s 澆水成功!'), strftime('[%F %T]'), mobile);
          } else {
            console.log(chalk.rgb(249,38,114)('%s %s 澆水失敗!'), strftime('[%F %T]'), mobile);
          }
          return await self.soilGrow(mobile, cookies, userAgent, timeout, self.count);
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 澆水重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試澆水失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 澆水超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.waterGrow(mobile, cookies, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 澆水失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.soilGrow = async (mobile, cookies, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .post(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9tYWN0aXZpdHkvYXJib3JkYXkvYXJib3IvMS8xLzEvZ3Jvdw==', 'base64').toString('utf8'))
          .set('User-Agent', userAgent)
          .set('Cookie', cookies)
          .type('form')
          .timeout({ deadline: timeout });
        if (response.ok) {
          var obj = JSON.parse(response.text);
          if ('addedValue' in obj) {
            // console.log(chalk.rgb(23,255,0)('%s %s 鬆土成功!'), strftime('[%F %T]'), mobile);
          } else {
            console.log(chalk.rgb(249,38,114)('%s %s 鬆土失敗!'), strftime('[%F %T]'), mobile);
          }
          return await self.wormGrow(mobile, cookies, userAgent, timeout, self.count);
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 鬆土重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試鬆土失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 鬆土超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.soilGrow(mobile, cookies, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 鬆土失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }

  self.wormGrow = async (mobile, cookies, userAgent, timeout, count) => {
    try {
      for(var i = 0; i < count; i++) {
        var response = await request
          .post(Buffer.from('aHR0cDovL20uY2xpZW50LjEwMDEwLmNvbS9tYWN0aXZpdHkvYXJib3JkYXkvYXJib3IvMS8yLzEvZ3Jvdw==', 'base64').toString('utf8'))
          .set('User-Agent', userAgent)
          .set('Cookie', cookies)
          .type('form')
          .timeout({ deadline: timeout });
        if (response.ok) {
          var obj = JSON.parse(response.text);
          if ('addedValue' in obj) {
            // console.log(chalk.rgb(23,255,0)('%s %s 除蟲成功!'), strftime('[%F %T]'), mobile);
          } else {
            console.log(chalk.rgb(249,38,114)('%s %s 除蟲失敗!'), strftime('[%F %T]'), mobile);
          }
          return true;
        } else {
          console.log(chalk.rgb(184,121,255)('%s %s 除蟲重試中...'), strftime('[%F %T]'), mobile);
          continue;      
        }
      }
      console.log(chalk.rgb(249,38,114)('%s %s 嘗試除蟲失敗!'), strftime('[%F %T]'), mobile);
      return false;
    } catch (error) {
      if (error.timeout) {
        console.log(chalk.rgb(184,121,255)('%s %s 除蟲超時! 重試中..'), strftime('[%F %T]'), mobile);
        return await self.wormGrow(mobile, cookies, userAgent, timeout, --count);
      } else {
        console.log(chalk.rgb(249,38,114)('%s %s 除蟲失敗: %s'), strftime('[%F %T]'), mobile, error);
        return false;
      }
    }
  }
}

module.exports = new UNICOM();
