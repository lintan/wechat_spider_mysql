var mysql = require('mysql'); //调用MySQL模块
var db    = {}; 
//创建一个connection
var pool = mysql.createPool({
    connectionLimit : 10,  
    host: 'localhost', //主机
    user: 'root', //MySQL认证用户名
    password: 'root', //MySQL认证用户密码
    port: '3306', //端口号
    database: 'wechat', //数据库名
});

/*connection.connect(function(err) {
    if (err) {
        console.log('[query] - :' + err);
        return;
    }
    console.log('[connection connect]  succeed!');
});*/
db.query = function(sql, callback){  
  
    if (!sql) {  
        callback();  
        return;  
    }  
    pool.query(sql, function(err, rows, fields) {  
      if (err) {  
        console.log(err);  
        callback(err, null);  
        return;  
      };  
  
      callback(null, rows, fields);  
    });  
} 
db.formatStr = function(str){  
    if(str){
         var dict = {'\b': 'b', '\t': 't', '\n': 'n', '\v': 'v', '\f': 'f', '\r': 'r'};
        return str.replace(/([\\'"\b\t\n\v\f\r])/g, function ($0, $1) {
            return '\\' + (dict[$1] || $1);
        });
    }else{
        return '';
    }
} 
//执行SQL语句
/*connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
    if (err) {
        console.log('[query] - :' + err);
        return;
    }
    console.log('The solution is: ', rows[0].solution);
});*/
//关闭connection
/*connection.end(function(err) {
    if (err) {
        return;
    }
    console.log('[connection end] succeed!');
});*/
db.insert = function(sql,callback) {
    db.query(sql, function(err, result) {
       if (callback) {
            if (!err) {
                var success = result.affectedRows > 0;
                callback(success);
            } else {
                callback(false);
            }
        }
    });
};
db.update = function(sql,callback) {
    db.query(sql, function(err, result) {
        if (callback) {
            if (!err) {
                var success = result.affectedRows > 0;
                callback(success);
            } else {
                callback(false);
            }
        }
    });
};
db.delete = function(sql,callback) {
    db.query(sql, function(err, result) {
        if (callback) {
            if (!err) {
                var success = result.affectedRows > 0;
                callback(success);
            } else {
                callback(false);
            }
        }
    });
};
//ep:'SELECT * FROM wx_article WHERE id=286 '
db.getOne = function(sql,callback) {
    db.query(sql, function(err, result, fields) {
        if (err) {
            //console.log('[query] - :' + err);
            callback(false);
        }
        var success = result.length > 0;
        if(!success){
           // console.log('[query] - :' + err);
           callback(false);
        }else{
            callback(result[0])
        }
        
        //console.log('article_title is: ', rows[0].article_title);
    });
};
db.getList = function(sql,callback) {
    db.query(sql, function(err, result, fields) {
        if (err) {
             callback(false);
        }
        var success = result.affectedRows > 0;
        if(!success){
           // console.log('[query] - :' + err);
           callback(false);
        }
        callback(result)
        //console.log('article_title is: ', rows[0].article_title);
    });
};
module.exports = db;
