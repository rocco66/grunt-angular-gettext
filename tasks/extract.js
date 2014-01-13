var cheerio, escapeRegex, esprima, mkAttrRegex, po,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

cheerio = require('cheerio');

po = require('node-po');

esprima = require('esprima');

escapeRegex = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;

mkAttrRegex = function(startDelim, endDelim) {
  var attrRegex, end, start;
  start = startDelim.replace(escapeRegex, "\\$&");
  end = endDelim.replace(escapeRegex, "\\$&");
  attrRegex = new RegExp(start + '\\s*(\'|"|&quot;)(.*?)\\1\\s*\\|\\s*translate\\s*' + end, 'g');
  return attrRegex;
};

module.exports = function(grunt) {
  return grunt.registerMultiTask('nggettext_extract', 'Extract strings from views', function() {
    var attrRegex, options;
    options = this.options({
      startDelim: '{{',
      endDelim: '}}'
    });
    attrRegex = mkAttrRegex(options.startDelim, options.endDelim);
    return this.files.forEach(function(file) {
      var addString, binaryExpressionWalkJs, catalog, escape, extractHtml, extractJs, failed, key, string, strings, walkJs;
      failed = false;
      catalog = new po();
      strings = {};
      escape = function(str) {
        str = str.replace(/\\/g, '\\\\');
        str = str.replace(/"/g, '\\"');
        return str;
      };
      addString = function(file, string, plural) {
        var item;
        if (plural == null) {
          plural = null;
        }
        string = string.trim();
        if (!strings[string]) {
          strings[string] = new po.Item();
        }
        item = strings[string];
        item.msgid = escape(string);
        if (__indexOf.call(item.references, file) < 0) {
          item.references.push(file);
        }
        if (plural && plural !== '') {
          if (item.msgid_plural && item.msgid_plural !== plural) {
            grunt.log.error("Incompatible plural definitions for " + string + ": " + item.msgid_plural + " / " + plural + " (in: " + (item.references.join(", ")) + ")");
            failed = true;
          }
          item.msgid_plural = escape(plural);
          return item.msgstr = ["", ""];
        }
      };
      extractHtml = function(filename) {
        var $, matches, src, _results;
        src = grunt.file.read(filename);
        $ = cheerio.load(src);
        $('*').each(function(index, n) {
          var node, plural, str;
          node = $(n);
          if (typeof node.attr('translate') !== 'undefined') {
            str = node.html();
            plural = node.attr('translate-plural');
            return addString(filename, str, plural);
          }
        });
        _results = [];
        while (matches = attrRegex.exec(src)) {
          _results.push(addString(filename, matches[2]));
        }
        return _results;
      };
      walkJs = function(node, fn) {
        var key, obj, _results;
        fn(node);
        _results = [];
        for (key in node) {
          obj = node[key];
          if (typeof obj === 'object') {
            _results.push(walkJs(obj, fn));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };
      binaryExpressionWalkJs = function(node) {
        var res;
        res = "";
        if (node.type === "Literal") {
          res = node.value;
        }
        if (node.type === 'BinaryExpression' && node.operator === '+') {
          res += binaryExpressionWalkJs(node.left);
          res += binaryExpressionWalkJs(node.right);
        }
        return res;
      };
      extractJs = function(filename) {
        var src, syntax;
        src = grunt.file.read(filename);
        syntax = esprima.parse(src, {
          tolerant: true
        });
        return walkJs(syntax, function(node) {
          var arg, str, _ref;
          if ((node != null ? node.type : void 0) === 'CallExpression' && ((_ref = node.callee) != null ? _ref.name : void 0) === 'gettext' && (node["arguments"] != null)) {
            arg = node["arguments"][0];
            switch (arg.type) {
              case 'Literal':
                str = arg.value;
                break;
              case 'BinaryExpression':
                str = binaryExpressionWalkJs(arg);
            }
            if (str) {
              return addString(filename, str);
            }
          }
        });
      };
      file.src.forEach(function(input) {
        if (input.match(/\.(htm(|l)|php|phtml)$/)) {
          extractHtml(input);
        }
        if (input.match(/\.js$/)) {
          return extractJs(input);
        }
      });
      catalog.headers = {
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit"
      };
      for (key in strings) {
        string = strings[key];
        catalog.items.push(string);
      }
      if (!failed) {
        return grunt.file.write(file.dest, catalog.toString());
      }
    });
  });
};

module.exports.mkAttrRegex = mkAttrRegex;
