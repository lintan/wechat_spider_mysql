# wechat_spider_mysql

基于anyproxy，在lijinma的wechat_spider上改的，感谢@lijinma
https://github.com/lijinma/wechat_spider
他那边也有详细的教程




1、创建数据表
```bash
CREATE TABLE `cms_weixin_mp_posts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `article_title` varchar(255) DEFAULT NULL,
  `article_author` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `is_original` varchar(255) DEFAULT NULL,
  `article_publish_time` varchar(255) DEFAULT NULL,
  `article_content` text,
  `content_url` varchar(255) DEFAULT NULL,
  `update_time` int(11) DEFAULT NULL,
  `status` tinyint(2) DEFAULT '0',
  `contentid` int(11) DEFAULT NULL,
  `biz` varchar(255) DEFAULT NULL,
  `appmsgid` varchar(45) DEFAULT NULL,
  `cover` varchar(255) DEFAULT NULL,
  `digest` varchar(255) DEFAULT NULL,
  `idx` int(11) DEFAULT NULL,
  `source_url` varchar(255) DEFAULT NULL,
  `read_num` int(11) DEFAULT NULL,
  `like_num` int(11) DEFAULT '0',
  `reward_num` int(11) DEFAULT '0',
  `electedCommentNum` int(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='采集微信文章';

```

2、安装

前提是你安装好了node环境

```bash
npm install wechat_spider_mysql -g
```

进入安装好的目录，找到mysql.js 修改mysql账号密码


3、启动
在命令行输入
```bash
wechat_spider_mysql
```

4、设置手机代理


5、访问微信公众号历史文章，并上拉，加载需要采集的文章

6、进入详情页
会自动跳转下一篇文章，但是会遇到文章被删除，被举报等，代码就跑不动了，所以得调试，得有耐心
这样太麻烦，所以我用php去采集文章页，但是这样就采集不到点赞数

## 打赏
如果这个小工具对你有帮助，你可以请我喝杯咖啡，谢谢 :)


![](http://ofh9pu5l3.bkt.clouddn.com/lintan.png)


## LICENSE

MIT.


