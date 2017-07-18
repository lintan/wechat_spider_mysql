var utils = require("./util"),
    bodyParser = require("body-parser"),
    path = require("path"),
    fs = require("fs"),
    http = require("http"),
    cheerio = require("cheerio"),
    sd = require("silly-datetime"),
    Promise = require("promise");

var interceptFlag = false,
    mysql = require('./mysql.js');

//e.g. [ { keyword: 'aaa', local: '/Users/Stella/061739.pdf' } ]
var mapConfig = [],
    configFile = "mapConfig.json";

function saveMapConfig(content, cb) {
    new Promise(function(resolve, reject) {
            var anyproxyHome = utils.getAnyProxyHome(),
                mapCfgPath = path.join(anyproxyHome, configFile);

            if (typeof content == "object") {
                content = JSON.stringify(content);
            }
            resolve({
                path: mapCfgPath,
                content: content
            });
        })
        .then(function(config) {
            return new Promise(function(resolve, reject) {
                fs.writeFile(config.path, config.content, function(e) {
                    if (e) {
                        reject(e);
                    } else {
                        resolve();
                    }
                });
            });
        })
        .catch(function(e) {
            cb && cb(e);
        })
        .done(function() {
            cb && cb();
        });
}

function getMapConfig(cb) {
    var read = Promise.denodeify(fs.readFile);

    new Promise(function(resolve, reject) {
            var anyproxyHome = utils.getAnyProxyHome(),
                mapCfgPath = path.join(anyproxyHome, configFile);

            resolve(mapCfgPath);
        })
        .then(read)
        .then(function(content) {
            return JSON.parse(content);
        })
        .catch(function(e) {
            cb && cb(e);
        })
        .done(function(obj) {
            cb && cb(null, obj);
        });
}

setTimeout(function() {
    //load saved config file
    getMapConfig(function(err, result) {
        if (result) {
            mapConfig = result;
        }
    });
}, 1000);


module.exports = {
    token: Date.now(),
    summary: function() {
        var tip = "the default rule for AnyProxy.";
        return tip;
    },

    shouldUseLocalResponse: function(req, reqBody) {
        //intercept all options request
        var simpleUrl = (req.headers.host || "") + (req.url || "");
        mapConfig.map(function(item) {
            var key = item.keyword;
            if (simpleUrl.indexOf(key) >= 0) {
                req.anyproxy_map_local = item.local;
                return false;
            }
        });


        return !!req.anyproxy_map_local;
    },

    dealLocalResponse: function(req, reqBody, callback) {
        if (req.anyproxy_map_local) {
            fs.readFile(req.anyproxy_map_local, function(err, buffer) {
                if (err) {
                    callback(200, {}, "[AnyProxy failed to load local file] " + err);
                } else {
                    var header = {
                        'Content-Type': utils.contentType(req.anyproxy_map_local)
                    };
                    callback(200, header, buffer);
                }
            });
        }
    },
    saveAndReplaceImage: function(content, biz, appmsgid) {
        if (content) {


            $ = cheerio.load(content, { decodeEntities: false });
            var img_list = $('img');
            var path = './wxdownloadimages/' + biz + '/' + appmsgid + '/';
            this.mkdirs(path);
            var that = this;
            img_list.each(function(item) {
                var src = $(this).attr('data-src');
                //console.log(src+'=====');
                var time = sd.format(new Date(), 'YYYYMMDDHHmmss');
                var noncestr = Math.ceil(Math.random() * 10);
                var a = src.split('?wx_fmt=');
                var ext = a[1];
                if (ext == 'jpeg') {
                    ext = 'jpg';
                }

                var filename = path + time + noncestr + '.' + ext;
                //console.log(filename);

                var sql = "select * from wx_imgs where url='"+src+"'";
                mysql.getOne(sql,function(rs){
                    if(!rs){
                        that.saveImage(src, filename);
                        var isql = "insert into wx_imgs (`url`,filename)values('"+src+"','"+filename+"')";
                        mysql.insert(isql);  
                    }
                      
                });

                content.replace(new RegExp(src, 'g'), filename);

            });
        }
        return content;

    },

    saveImage: function(url, filename) {
        http.get(url, function(res) {
            var imgData = "";

            res.setEncoding("binary"); //一定要设置response的编码为binary否则会下载下来的图片打不开


            res.on("data", function(chunk) {
                imgData += chunk;
            });

            res.on("end", function() {
                fs.writeFile(filename, imgData, "binary", function(err) {
                    if (err) {
                        console.log("down fail");
                    }
                    console.log("down success");
                });
            });
        });
    },
    mkdirs: function(dirpath, dirname) {
        //判断是否是第一次调用
        if (typeof dirname === "undefined") {
            if (fs.existsSync(dirpath)) {
                return;
            } else {
                this.mkdirs(dirpath, path.dirname(dirpath));
            }
        } else {
            //判断第二个参数是否正常，避免调用时传入错误参数
            if (dirname !== path.dirname(dirpath)) {
                this.mkdirs(dirpath);
                return;
            }
            if (fs.existsSync(dirname)) {
                fs.mkdirSync(dirpath)
            } else {
                this.mkdirs(dirname, path.dirname(dirname));
                fs.mkdirSync(dirpath);
            }
        }
    },
    replaceRequestProtocol: function(req, protocol) {},


    replaceRequestOption: function(req, option) {
        var newOption = option;
        if (/google/i.test(newOption.headers.host)) {
            newOption.hostname = "www.baidu.com";
            newOption.port = "80";
        }
        return newOption;
    },

    replaceRequestData: function(req, data) {},

    replaceResponseStatusCode: function(req, res, statusCode) {},

    replaceResponseHeader: function(req, res, header) {},

    getPosts: function(rawList) {
        var list = JSON.parse(rawList);
        return list.list;
    },
    savePosts: function(rawList) {
        var that = this;
        var list = this.getPosts(rawList);
        list.forEach(function(item) {
            if (item["app_msg_ext_info"] === undefined) {
                return;
            }
            var idx = 1;
            var msgInfo = item.app_msg_ext_info;
            var datetime = item.comm_msg_info.datetime;
            msgInfo.idx = idx;
            msgInfo.datetime = datetime;
            that.writePost(msgInfo);
            // 解决一次多篇文章的问题
            if (item["app_msg_ext_info"]["multi_app_msg_item_list"] === undefined) {
                return;
            }
            var multiList = item["app_msg_ext_info"]["multi_app_msg_item_list"];
            multiList.forEach(function(item) {
                item.idx = ++idx;
                item.datetime = datetime;
                that.writePost(item);
            });
        })
    },

    splitOnce: function(input, splitBy) {
        var i = input.indexOf(splitBy);

        return [input.slice(0, i), input.slice(i + 1)];
    },

    parseQuery: function(qstr) {
        var query = {};
        if (qstr && qstr.indexOf('&') >= 0) {
            var a = qstr.split('&');
            for (var i = 0; i < a.length; i++) {
                var b = this.splitOnce(a[i], '=');
                query[b[0]] = b[1] || '';
            }
        }

        return query;
    },

    getRawQuery: function(webUrl) {
        var url = require('url');
        var parsedUrl = url.parse(webUrl);
        var query = parsedUrl.query;
        query = this.parseQuery(query);
        delete query.frommsgid;
        delete query.count;
        delete query.f;
        var result = '';
        for (var key in query) {
            if (query.hasOwnProperty(key)) {
                result += key + '=' + query[key] + '&';
            }
        }

        return result;
    },

    getNextUrl: function(currentUrl, rawList, type) {

        var list = this.getPosts(rawList);
        if (!list) {
            return '';
        }
        var lastOne = list.pop();
        if (!lastOne) {
            //如果列表中没有数据，开始抓文章
            var nextUrl = 'https://www.lijinma.com/wechat_begin.html';
            return nextUrl;
        }
        var rawQuery = '';
        var rawQuery = this.getRawQuery(currentUrl);

        var lastId = lastOne.comm_msg_info.id;
        if (type == 1) {
            var nextUrl = "http://mp.weixin.qq.com/mp/getmasssendmsg?" + rawQuery + "frommsgid=" + lastId + "&count=10"
        } else if (type == 2) {
            var nextUrl = "http://mp.weixin.qq.com/mp/profile_ext?action=getmsg&" + rawQuery + "frommsgid=" + lastId + "&count=10"
        }

        return nextUrl;
    },

    getBizFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.__biz;
    },

    getIdxFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        return parsedQuery.idx;
    },

    getMidFromUrl: function(url) {
        var rawQuery = this.getRawQuery(url);
        var parsedQuery = this.parseQuery(rawQuery);
        if (parsedQuery.mid) {
            return parsedQuery.mid;
        } else if (parsedQuery['amp;mid']) {
            return parsedQuery['amp;mid']
        } else if (parsedQuery['amp;amp;mid']) {
            return parsedQuery['amp;amp;mid']
        } else {
            return parsedQuery.appmsgid;
        }
    },
    contains:function (arr, obj) {  
        var i = arr.length;  
        while (i--) {  
            if (arr[i] === obj) {  
                return true;  
            }  
        }  
        return false;  
    },
    writePost: function(msgInfo) {
        var article_author = msgInfo.author?msgInfo.author:'-';
        var article_title = msgInfo.title;
        var content_url = msgInfo.content_url;
        content_url = msgInfo.content_url.replace(/amp;/g, "");
        var biz = this.getBizFromUrl(content_url);
        //限定公众号
        var arr = new Array('MzA5Mjg1MDAzNQ==','MjM5NjAzNzE2MA==','MjM5MDY3MzQ2Nw==','MzAxNzAwOTc0Mg==','MzAxMTQ3MDgzMQ==','MjM5ODEyMzc0MQ==','MzA5NTI5OTA5MA==');  
        //['MzA5Mjg1MDAzNQ==','MjM5NjAzNzE2MA==','MjM5MDY3MzQ2Nw==','MzAxNzAwOTc0Mg==','MzAxMTQ3MDgzMQ==','MjM5ODEyMzc0MQ==','MzA5NTI5OTA5MA==']
        if(this.contains(arr, biz)){
            var appmsgid = this.getMidFromUrl(content_url);
            var cover = msgInfo.cover; //.replace(/\\\//g, "/");
            var digest = msgInfo.digest;
            var idx = msgInfo.idx;
            var source_url = msgInfo.source_url;
            var article_publish_time = new Date(msgInfo.datetime * 1000);
            //article_author, biz, appmsgid, article_title, content_url, cover, digest, idx, source_url, article_publish_time, article_content
            //'INSERT INTO cms_weixin_mp_posts (`article_author`, `biz`, `appmsgid`, `article_title`, `content_url`, `cover`, `digest`, `idx`, `source_url`,`article_content`, `article_publish_time`) VALUES (' + author + ', ' + biz + ', ' + appmsgid + ', ' + article_title + ', ' + content_url + ', ' + cover + ', ' + digest + ', ' + idx + ', ' + source_url + ', ' + article_content + ', ' + article_publish_time + ')'
            var get_sql = "select id  from cms_weixin_mp_posts where article_title='" + article_title + "' limit 1";
            mysql.getOne(get_sql, function(rs) {
                if (!rs) {
                    var sql = 'INSERT INTO cms_weixin_mp_posts (`article_author`, `biz`, `appmsgid`, `article_title`, `content_url`, `cover`, `digest`, `idx`, `source_url`,`article_publish_time`) VALUES ("' + article_author + '", "' + biz + '", "' + appmsgid + '", "' + article_title + '", "' + content_url + '", "' + cover + '", "' + digest + '", "' + idx + '","' + source_url + '", "' + article_publish_time + '")'
                    mysql.insert(sql, function(rs) {});

                }
            });
        }
        

    },

    getNextChunk: function(url, delay, nonce) {
        if (nonce) {
            var next = '<script nonce="' + nonce + '" type="text/javascript">';
        } else {
            var next = '<script type="text/javascript">';
        }
        next += 'setTimeout(function(){window.location.href="' + url + '";},' + delay + ');';
        next += 'setTimeout(function(){window.location.href="' + url + '";},10000);';
        next += '</script>';
        return next;
    },

    getNotification: function() {
        return '<h1 style="color:red; font-size:20px; text-align: center; margin-top: 10px; margin-bottom: 10px;">3秒后没有自动刷新请手动刷新</h1>';
    },

    getNextPostUrl: function(appmsgid, nonce, callback) {
        var get_sql = "select id,content_url  from cms_weixin_mp_posts where appmsgid='" + appmsgid + "' and read_num=0 limit 1";
        mysql.getOne(get_sql, function(rs) {
            if (rs) {
                callback(rs.content_url,nonce);
            }
        });
    },

    getContentUrl: function(reqUrl) {
        return 'http://mp.weixin.qq.com' + reqUrl;
    },
    getNextPostJson: function(reqUrl) {


        return 'http://mp.weixin.qq.com' + reqUrl;
    },
    //替换服务器响应的数据
    replaceServerResDataAsync: function(req, res, serverResData, callback) {

        var that = this;
        if (/mp\/getmasssendmsg/i.test(req.url)) {
            try {
                var reg = /msgList = (.*?);\r\n/;
                var ret = reg.exec(serverResData.toString());
                if (!ret) {
                    callback(serverResData);
                    return;
                }
                ret = ret[1]
                this.savePosts(ret)

                /*var nextUrl = this.getNextUrl(req.url, ret);
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl, 1000);
                    var note = that.getNotification();
                    serverResData = note + serverResData + next;
                    callback(serverResData);
                }*/
                var nextUrl = this.getNextUrl(req.url, ret);
                if (nextUrl) {

                }
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/mp\/profile_ext\?action=home/i.test(req.url)) {
            try {
                var reg = /var msgList = \'(.*?)\';/;
                var ret = reg.exec(serverResData.toString());
                var ret = ret[1].replace(/&quot;/g, '"');
                if (!ret) {
                    callback(serverResData);
                    return;
                }
                this.savePosts(ret)

                /*var nextUrl = this.getNextUrl(req.url, ret);
                if (nextUrl) {
                    var next = this.getNextChunk(nextUrl, 1000);
                    var note = that.getNotification();
                    serverResData = note + serverResData + next;
                    //callback(serverResData);
                    callback(serverResData);
                    return;
                }*/

                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/mp\/profile_ext\?action=getmsg/i.test(req.url)) { //第二种页面表现形式的向下翻页后的json
            try {
                var json = JSON.parse(serverResData.toString());
                if (json.general_msg_list != []) {
                    this.savePosts(json.general_msg_list)
                }
                /*var nextUrl = this.getNextUrl(req.url, json.general_msg_list);
                if (nextUrl) {
                    
                    return;
                }*/
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
            //callback(serverResData);
        } else if (/s\?__biz=/i.test(req.url)) {
            try {
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                var reg = /<strong class=\"profile_nickname\">(.*?)<\/strong>/;
                var ret = reg.exec(serverResData.toString());
                //var content_reg =  /<div id=\"page-content\"(.*?)<script nonce=\"/;
                //var content_ret = content_reg.exec(serverResData.toString());
                $ = cheerio.load(serverResData.toString(), { decodeEntities: false });
                var content = mysql.formatStr($('#js_content').html());

                // return;
                //替换图片
               // content = this.saveAndReplaceImage(content, biz, appmsgid);
                //return ;
                //console.log(content);
                if (ret) {
                    var gsql = "select * from cms_weixin_mp_posts  where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                    mysql.getOne(gsql, function(info) {
                        if (info) {
                            var usql = "update cms_weixin_mp_posts set source='"+ret[1]+"',article_content='"+content+"' where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                            mysql.update(usql,function(rs){

                            });
                        } else {
                            var listsql = "select * from cms_weixin_mp_posts  where appmsgid='"+appmsgid+"' ";
                            mysql.getList(listsql, function(posts) {
                                for (var i = 0, item; item = posts[i++];) {
                                    var content_url = item.content_url;
                                    var liidx = that.getIdxFromUrl(content_url);
                                    if (liidx != item.idx) {
                                        var usql2 = "update cms_weixin_mp_posts set idx='"+liidx+"' where biz='"+item.biz+"' and appmsgid='"+item.appmsgid+"' and idx="+item.idx;
                                        mysql.update(usql2,function(rs){

                                        });
                                    }
                                }

                            });
                        }
                    });
                }
                //return;
                var nonce = 0;
                var reg = /<script nonce=\"(.*?)\"/;
                var ret = reg.exec(serverResData.toString());
                if (ret) {
                    nonce = ret[1];
                }
                that.getNextPostUrl(appmsgid, nonce, function(nextUrl, nonce) {
                    var next = that.getNextChunk(nextUrl, 3000, nonce);
                    var note = that.getNotification();
                    serverResData = note + serverResData + next;
                    callback(serverResData);
                });
            } catch (e) {
                console.log(e);
            }
        } else if (/mp\/getappmsgext\?__biz/i.test(req.url)) {
            try {
                var appmsgext = JSON.parse(serverResData.toString());
                if (!appmsgext.appmsgstat) {
                    callback(serverResData);
                    return;
                }
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                var gsql= "select * from cms_weixin_mp_posts  where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                mysql.getOne(gsql, function(info) {
                    if (info) {
                        var read_num = appmsgext.appmsgstat.read_num?appmsgext.appmsgstat.read_num:0;
                        var like_num = appmsgext.appmsgstat.like_num?appmsgext.appmsgstat.like_num:0;
                        var reward_num = appmsgext.reward_total_count?appmsgext.reward_total_count:0;
                        var usql = "update cms_weixin_mp_posts set read_num='"+read_num+"',like_num='"+like_num+"',reward_num='"+reward_num+"' where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                        mysql.update(usql, function(rs){
                            console.log('---update read_num---');
                        });
                    } else {
                        var listsql = "select * from cms_weixin_mp_posts  where appmsgid='"+appmsgid+"' ";
                        mysql.getList(listsql, function(posts) {
                            for (var i = 0, item; item = posts[i++];) {
                                var content_url = item.content_url;
                                var liidx = that.getIdxFromUrl(content_url);
                                if (liidx != item.idx) {
                                    var usql2 = "update cms_weixin_mp_posts set idx='"+liidx+"' where biz='"+item.biz+"' and appmsgid='"+item.appmsgid+"' and idx="+item.idx;
                                    mysql.update(usql2,function(rs){

                                     });
                                }
                            }

                        });
                    }
                });




                callback(serverResData);
            } catch (e) {
                console.log(e);
            }

        } else if (/mp\/appmsg_comment\?action=getcommen/i.test(req.url)) {
            //这个是回复列表
            try {
                var appmsgComment = JSON.parse(serverResData.toString());
                var biz = this.getBizFromUrl(req.url);
                var appmsgid = this.getMidFromUrl(req.url);
                var idx = this.getIdxFromUrl(req.url);
                var gsql= "select * from cms_weixin_mp_posts  where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                mysql.getOne(gsql, function(info) {
                    if (info) {
                        var electedCommentNum = appmsgComment.elected_comment_total_cnt?appmsgComment.elected_comment_total_cnt:0;
                        var usql = "update cms_weixin_mp_posts set electedCommentNum='"+electedCommentNum+"' where biz='"+biz+"' and appmsgid='"+appmsgid+"' and idx="+idx;
                        mysql.update(usql, function(rs){
                            console.log('---update electedCommentNum---');
                        });
                    } else {
                        var listsql = "select * from cms_weixin_mp_posts  where appmsgid='"+appmsgid+"' ";
                        mysql.getList(listsql, function(posts) {
                            for (var i = 0, item; item = posts[i++];) {
                                var content_url = item.content_url;
                                var liidx = that.getIdxFromUrl(content_url);
                                if (liidx != item.idx) {
                                    var usql2 = "update cms_weixin_mp_posts set idx='"+liidx+"' where biz='"+item.biz+"' and appmsgid='"+item.appmsgid+"' and idx="+item.idx;
                                    mysql.update(usql2,function(rs){

                                    });
                                }
                            }

                        });
                    }
                });
                

                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/wechat_spider\.html/i.test(req.url)) {
            //这个是回复列表
            try {
                callback(serverResData);
            } catch (e) {
                console.log(e);
            }
        } else if (/wechat_begin\.html/i.test(req.url)) {
            //这个是回复列表
            try {
                var appmsgid = 0;
                that.getNextPostUrl(appmsgid, 0, function(nextUrl) {
                    var next = that.getNextChunk(nextUrl, 3000);
                    serverResData = serverResData + next;
                    callback(serverResData);
                });
            } catch (e) {
                console.log(e);
            }
        } else {
            callback(serverResData);
        }
    },
    pauseBeforeSendingResponse: function(req, res) {},

    shouldInterceptHttpsReq: function(req) {
        return interceptFlag;
    },

    //[beta]
    //fetch entire traffic data
    fetchTrafficData: function(id, info) {},

    setInterceptFlag: function(flag) {
        interceptFlag = flag;
    },

    _plugIntoWebinterface: function(app, cb) {

        app.get("/filetree", function(req, res) {
            try {
                var root = req.query.root || utils.getUserHome() || "/";
                utils.filewalker(root, function(err, info) {
                    res.json(info);
                });
            } catch (e) {
                res.end(e);
            }
        });

        app.use(bodyParser.json());
        app.get("/getMapConfig", function(req, res) {
            res.json(mapConfig);
        });
        app.post("/setMapConfig", function(req, res) {
            mapConfig = req.body;
            res.json(mapConfig);

            saveMapConfig(mapConfig);
        });
        cb();
    },

    _getCustomMenu: function() {
        return [
            // {
            //     name:"test",
            //     icon:"uk-icon-lemon-o",
            //     url :"http://anyproxy.io"
            // }
        ];
    }
};
