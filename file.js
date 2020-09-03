const express = require("express");
const router = express.Router();
const multer = require('multer');
const string2fileStream = require('string-to-file-stream');
const path = require('path');
var fs = require('fs')
var zlib = require('zlib')
var tar = require('tar')
var fstream = require('fstream')
router.use((req, res, next) => {
  next()
})

router.post("/upload", function (req, res) {
  var storage = multer.diskStorage({
    destination: path.join(__dirname, '/uploads')
  });
  var upload = multer({
    storage: storage
  }).any();

  upload(req, res, function (err) {
    if (err) {
      return res.end('Error');
    } else {
      let account = req.body.account;
      if (!account) {
        res.json({
          ret_code: -1,
          ret_msg: 'account is required!'
        });
        return
      }
      req.files.forEach(function (item) {
        let time = Date.now() + parseInt(Math.random() * 999) + parseInt(Math.random() * 2222);
        //拓展名
        let extname = item.mimetype.split('/')[1]
        //拼接成图片名
        let keepname = time + '.' + extname
        fs.exists(path.join(__dirname, '/uploads/' + account + '/' + keepname), function (exists) {  //path为文件夹路径
          var retTxt = exists ? retTxt = '文件存在' : '文件不存在';
          if (retTxt == '文件存在') {
            fs.writeFile(path.join(__dirname, '/uploads/' + account + '/' + keepname), item.path, (err) => {
              if (err) { return res.send('写入失败') }
              res.send({ err: 0, msg: '上传ok,覆盖', path: keepname })
            });
          } else {
            fs.mkdir(path.join(__dirname, '/uploads/' + account), function (err) {
              fs.readFile(item.path, (err, data) => {
                if (err) { return res.send('上传失败') }
                fs.writeFile(path.join(__dirname, '/uploads/' + account + '/' + keepname), data, (err) => {
                  if (err) { return res.send('写入失败') }
                  res.send({ err: 0, msg: '上传ok，新增', path: keepname })
                });
              });
            })
          }
        })



      });
      // res.end('File uploaded'); 
    }
  });
});

function makeNewDir (dir_path, dir) {
  if (!dir_path) {
    return
  }

  if (fs.existsSync(path.join(__dirname, '/uploads/' + dir_path))) {
    if (dir[0]) {
      makeNewDir(dir_path + '/' + dir[0], dir.slice(1))
    }


  } else {
    fs.mkdirSync(path.join(__dirname, '/uploads/' + dir_path))

    if (dir[0]) {
      fs.mkdirSync(path.join(__dirname, '/uploads/' + dir_path + '/' + dir[0]))
      if (dir[1]) {
        makeNewDir(dir_path + '/' + dir[0], dir.slice(1))
      }
    }
  }

}
router.post("/uploads", function (req, res) {
  var storage = multer.diskStorage({
    destination: path.join(__dirname, '/uploads')
  });
  var uploads = multer({
    storage: storage
  }).any();

  uploads(req, res, function (err) {
    let dir = JSON.parse(req.body.dir)

    if (!fs.existsSync(path.join(__dirname, '/uploads/' + req.body.account))) {


      fs.mkdirSync(path.join(__dirname, '/uploads/' + req.body.account))
    }

    dir.forEach(dirPath => {
      let newdirPath = dirPath.split('/')
      newdirPath.pop()
      makeNewDir(req.body.account, newdirPath)
    });

    console.log('文件路径创建成功')
    if (err) {
      console.log('error!!!!', err);
      return res.end('Error');
    } else {
      let account = req.body.account;
      if (!account) {
        res.json({
          ret_code: -1,
          ret_msg: 'account is required!'
        });
        return
      }
      req.files.forEach(function (item, index) {
        fs.readFile(item.path, (err, data) => {
          if (err) { return res.send('上传失败') }
          fs.writeFile(path.join(__dirname, '/uploads/' + account + '/' + dir[index]), data, (err) => {
            if (err) { return res.send('写入失败') }

            // res.send({ err: 0, msg: '上传ok，新增', path: dir[index] })
            if (index == req.files.length) {
              res.send({ err: 0, msg: '上传ok，新增', path: dir[index] })
            }
          });
        });

      });

    }
  });

});
router.get("/get", function (req, res) {
  let pageSize = req.query.pageSize ? req.query.pageSize : 10;
  let pageNum = req.query.pageNum ? req.query.pageNum : 1;
  let queryPath = req.query.path ? '/' + req.query.path : ''
  const filepath = path.join(__dirname, '/uploads/' + req.query.account + queryPath)
  try {
    var files = fs.readdirSync(filepath);//需要用到同步读取
    let fileData = []
    let totalSize = 0
    if (req.query.name) {
      files = files.filter(item => {
        return item.indexOf(req.query.name) !== -1
      })
    }
    let pagedFiles = files.slice(pageNum > 1 ? (pageNum - 1) * pageSize : 0, pageNum > 1 ? pageNum * pageSize - 1 : pageSize - 1)
    pagedFiles.forEach(function (file) {
      var states = fs.statSync(filepath + '/' + file);
      // if(states.isDirectory())
      // {
      //     this.readFile(path+‘/‘+file,filesList);
      // }
      // else
      {
        //创建一个对象保存信息
        var obj = {
          size: '',
          name: '',
          path: ''
        };
        obj.size = states.size;//文件大小，以字节为单位
        obj.isFolder = !states.isFile()
        obj.name = file;//文件名
        obj.path = filepath + '/' + file; //文件绝对路径
        fileData.push(obj)
        totalSize += states.size
      }

    })
    res.json({
      data: {
        list: fileData,
        totalSize: totalSize,
        pageSize: pageSize,
        pageNum: pageNum,
        pages: Math.ceil(files.length / pageSize),
        total: files.length,
      },

      ret_code: 1,
      ret_msg: 'success'
    });
  } catch (error) {
    console.log(error)
    res.json({
      ret_code: -1,
      ret_msg: '文件不存在'
    });
  }


});
router.get("/getAll", function (req, res) {
  const param = {
    account: req.query.account,
  }
  const filepath = path.join(__dirname, '/uploads/' + req.query.account)
  try {
    let tree = fileTree(filepath, 1, '', []);

    res.json({
      data: tree,
      ret_code: 1,
      ret_msg: 'success'
    });
  } catch (error) {
    res.json({
      ret_code: -1,
      ret_msg: '文件不存在'
    });
  }


});
router.get("fileServer/:account/:path", function (req, res) {
  let queryPath = req.query.path ? '/' + req.query.path : ''
  const filepath = path.join(__dirname, '/uploads/' + req.query.account + queryPath)
  fs.exists(filePath, function (exists) {
    res.sendfile(exists ? filePath : '');
  });

});

router.post("/delete", function (req, res) {
  const account = req.body.account;
  const filepath = path.join(__dirname, '/uploads/' + account + '/' + req.body.path)
  try {
    fs.unlink(filepath, function (err) {
      if (err) {
        throw err;
      }
      res.json({
        ret_code: 1,
        ret_msg: '删除成功'
      });
    })
  } catch (error) {
    res.json({
      ret_code: -1,
      ret_msg: '删除失败'
    });
  }


});
router.post("/rename", function (req, res) {
  const account = req.body.account;
  const filepath = path.join(__dirname, '/uploads/' + account + '/' + req.body.path)
  const newName = path.join(__dirname, '/uploads/' + account + '/' + req.body.newName)

  try {
    fs.rename(filepath, newName, function (err) {
      if (err) {
        throw err;
      }
      res.json({
        ret_code: 1,
        ret_msg: '重命名成功'
      });
    })
  } catch (error) {
    res.json({
      ret_code: -1,
      ret_msg: '重命名失败'
    });
  }


});
router.post("/move", function (req, res) {
  const account = req.body.account;
  const sourceFile = path.join(__dirname, '/uploads/' + account + '/' + req.body.oldPath)
  const destPath = path.join(__dirname, '/uploads/' + account + '/' + req.body.newPath)
  try {
    // var readStream = fs.createReadStream(sourceFile);
    // var writeStream = fs.createWriteStream(destPath);
    // readStream.pipe(writeStream);
    createDocs(sourceFile, destPath, function () {
      deleteFolder(sourceFile);
    })
    res.json({
      ret_code: 1,
      ret_msg: '移动成功'
    });
  } catch (error) {
    res.json({
      ret_code: -1,
      ret_msg: '移动失败'
    });
  }


});
router.get("/download", function (req, res) {
  let fileName = req.query.name;
  let account = req.query.account;
  let fileDir = path.join(__dirname, '/uploads/' + account + '/' + req.query.path + '/' + fileName)
  let fileDir2 = path.join(__dirname, '/uploads/' + account + '/' + req.query.path + '/' + '444444.docx')
  console.log('fileDir', fileDir)
  stats = fs.statSync(fileDir);

  fs.exists(fileDir, function (exist) {
    if (exist) {
      res.set({
        "Content-type": "application/octet-stream",
        "Content-Disposition": "attachment;filename=" + encodeURI(fileName),
        'Content-Length': stats.size
      });

      let fReadStream = fs.createReadStream(fileDir);
      // fReadStream += fs.createReadStream(fileDir2);

      fReadStream.pipe(res);
    } else {
      res.set("Content-type", "text/html");
      res.send("file not exist!");
      res.end();
    }
  });


});
router.get("/batchDownload", function (req, res) {
  let account = req.query.account;
  let path = req.query.path;
  let filesList = req.query.name.split(',')


  newFolder = '????????????'
  filesList.forEach(element => {
    const sourceFile = path.join(__dirname, '/uploads/' + account + '/' + req.body.oldPath)
    const destPath = path.join(__dirname, '/uploads/' + account + '/' + req.body.newPath)

    createDocs(sourceFile, destPath, function () {

    })
  });

  let fileDir = path.join(path.join(__dirname, req.query.account + '_temp'))
  let stats = fs.statSync(fileDir);
  var output = fs.createWriteStream(path.join(__dirname, req.query.account + '_temp.zip'));
  var archive = archiver('zip', {
    zlib: { level: 99 }
  });



});
router.post("/getdirsize", function (req, res) {

  res.json({
    size: getdirsize(path.join(__dirname, '/uploads/' + req.query.account)),
    ret_code: 1,
    ret_msg: '文件不存在'
  });

});
function fileTree (target, deep, prev, tree) { //    target：当前文件的绝对路径    deep：层级
  // let prev = new Array(deep).join("/");
  let infos = fs.readdirSync(target);  // 读取当前文件目录
  let files = [];  // 创建一个数组 用来存放文件
  let dirs = [];  // 创建一个数组 用来存放文件夹

  infos.forEach(item => {  // 遍历获取到的当前文件
    let tmpdir = path.join(target, item);  //拼接文件的绝对路径
    let stat = fs.statSync(tmpdir);  // 获取文件的状态
    if (stat.isFile()) {  // 如果是一个文件
      files.push(item);   // 存放在files数组中
    } else {  // 如果不是一个文件
      dirs.push(item);  // 存放在dirs数组中
    }
  });

  dirs.forEach(item => {  // 遍历dirs数组  打印文件夹并递归
    tree.push(`${prev}/${item}`)
    let nexttarget = path.join(target, item); // 拼接文件夹的绝对路径 目的：以当前文件夹为目录
    let nextdeep = deep + 1;
    tree = fileTree(nexttarget, nextdeep, prev + '/' + item, tree)  // 再次调用tree函数  替换参数
  });

  let count = files.length - 1;   // 定义一个count 表示当前存放文件的数组长度-1
  files.forEach(item => {   // 遍历 files 数组
    tree.push(`${prev}/${item}`)
  })
  return tree
}
function getdirsize (dir, callback) {
  var size = 0;
  fs.stat(dir, function (err, stats) {
    if (err) return callback(err);//如果出错
    if (stats.isFile()) return callback(null, stats.size);//如果是文件

    fs.readdir(dir, function (err, files) {//如果是目录
      if (err) return callback(err);//如果遍历目录出错
      if (files.length == 0) return callback(null, 0);//如果目录是空的

      var count = files.length;//哨兵变量
      for (var i = 0; i < files.length; i++) {
        getdirsize(path.join(dir, files[i]), function (err, _size) {
          if (err) return callback(err);
          size += _size;
          if (--count <= 0) {//如果目录中所有文件(或目录)都遍历完成
            callback(null, size);
          }
        });
      }
    });
  });
}
function mkdirsSync (dirname) {
  if (fs.existsSync(dirname)) {
    return true;
  } else {
    if (mkdirsSync(path.dirname(dirname))) {
      console.log("mkdirsSync = " + dirname);
      fs.mkdirSync(dirname);
      return true;
    }
  }
}
function deleteFolder (path) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file, index) {
      let curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) {
        deleteFolder(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}
function _copy (src, dist) {
  var paths = fs.readdirSync(src)
  paths.forEach(function (p) {
    var _src = src + '/' + p;
    var _dist = dist + '/' + p;
    var stat = fs.statSync(_src)
    if (stat.isFile()) {// 判断是文件还是目录
      fs.writeFileSync(_dist, fs.readFileSync(_src));
    } else if (stat.isDirectory()) {
      copyDir(_src, _dist)// 当是目录是，递归复制
    }
  })
}

/*
* 复制目录、子目录，及其中的文件
* @param src {String} 要复制的目录
* @param dist {String} 复制到目标目录
*/
function copyDir (src, dist) {
  var b = fs.existsSync(dist)
  console.log("dist = " + dist)
  if (!b) {
    console.log("mk dist = ", dist)
    mkdirsSync(dist);//创建目录
  }
  console.log("_copy start")
  _copy(src, dist);
}

function createDocs (src, dist, callback) {
  console.log("createDocs...")
  copyDir(src, dist);
  console.log("copyDir finish exec callback")
  if (callback) {
    callback();
  }
}
module.exports = router;


