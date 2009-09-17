/**
 * Cookie plugin
 *
 * Copyright (c) 2006 Klaus Hartl (stilbuero.de)
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 */

jQuery.cookie = function(name, value, options) {
    if (typeof value != 'undefined') { // name and value given, set cookie
        options = options || {};
        if (value === null) {
            value = '';
            options.expires = -1;
        }
        var expires = '';
        if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
            var date;
            if (typeof options.expires == 'number') {
                date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
            } else {
                date = options.expires;
            }
            expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
        }
        // CAUTION: Needed to parenthesize options.path and options.domain
        // in the following expressions, otherwise they evaluate to undefined
        // in the packed version for some reason...
        var path = options.path ? '; path=' + (options.path) : '';
        var domain = options.domain ? '; domain=' + (options.domain) : '';
        var secure = options.secure ? '; secure' : '';
        document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
    } else { // only name given, get cookie
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
};

/**
 * Tagcloud plugin
 *
 * http://code.google.com/p/jquery-tagcloud/
 *
 */

jQuery.fn.tagCloud = function(cl, givenOptions) {

  if (!cl || !cl.length)
      return this;

   // Default settings:
   var defaults = {
     sort: function (a, b) {return a.tag < b.tag ? -1 : (a.tag == b.tag ? 0 : 1);},//default sorting: abc
      click: function(tag) {},
      maxFontSizeEm: 4
   };

   var options = {};
   jQuery.extend(options, defaults, givenOptions);

   // calculating the max and min count values
   var max = -1;
   var min = cl[0].count;
   $.each(cl, function(i, n) {
      max = Math.max(n.count, max);
      min = Math.min(n.count, min);
   });

   if (options.sort) {
      cl.sort(options.sort);
   }

   //Normalization helper
   var diff = ( max == min ? 1    // if all values are equal, do not divide by zero
                           : (max - min) / (options.maxFontSizeEm - 1) ); //optimization: Originally we want to divide by diff
                           // and multiple by maxFontSizeEm - 1 in getNormalizedSize.
   function getNormalizedSize(count) {
      return 1 + (count - min) / diff;
   }

   // Generating the output
   this.empty();
   for (var i = 0; i < cl.length; ++i) {
      var tag = cl[i].tag;
      var tagEl = jQuery('<a href="" class="tagcloudlink" style="font-size: '
                           + getNormalizedSize(cl[i].count)
                           + 'em">' + tag + '<\/a>')
                  .data('tag', tag);

      if (options.click) {
         tagEl.click(function(event) {
            event.preventDefault();
            options.click(jQuery(event.target).data('tag'), event);
         });
      }
      this.append(tagEl).append(" ");
   }
   return this;

};

// toJSON

(function ($) {
    var m = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        s = {
            'array': function (x) {
                var a = ['['], b, f, i, l = x.length, v;
                for (i = 0; i < l; i += 1) {
                    v = x[i];
                    f = s[typeof v];
                    if (f) {
                        v = f(v);
                        if (typeof v == 'string') {
                            if (b) {
                                a[a.length] = ',';
                            }
                            a[a.length] = v;
                            b = true;
                        }
                    }
                }
                a[a.length] = ']';
                return a.join('');
            },
            'boolean': function (x) {
                return String(x);
            },
            'null': function (x) {
                return "null";
            },
            'number': function (x) {
                return isFinite(x) ? String(x) : 'null';
            },
            'object': function (x) {
                if (x) {
                    if (x instanceof Array) {
                        return s.array(x);
                    }
                    var a = ['{'], b, f, i, v;
                    for (i in x) {
                        v = x[i];
                        f = s[typeof v];
                        if (f) {
                            v = f(v);
                            if (typeof v == 'string') {
                                if (b) {
                                    a[a.length] = ', ';
                                }
                                a.push(s.string(i), ':', v);
                                b = true;
                            }
                        }
                    }
                    a[a.length] = '}';
                    return a.join('');
                }
                return 'null';
            },
            'string': function (x) {
                if (/["\\\x00-\x1f]/.test(x)) {
                    x = x.replace(/([\x00-\x1f\\"])/g, function(a, b) {
                        var c = m[b];
                        if (c) {
                            return c;
                        }
                        c = b.charCodeAt();
                        return '\\u00' +
                            Math.floor(c / 16).toString(16) +
                            (c % 16).toString(16);
                    });
                }
                return '"' + x + '"';
            }
        };

	$.toJSON = function(v) {
		var f = isNaN(v) ? s[typeof v] : s['number'];
		if (f) return f(v);
	};

	$.parseJSON = function(v, safe) {
		if (safe === undefined) safe = $.parseJSON.safe;
		if (safe && !/^("(\\.|[^"\\\n\r])*?"|[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t])+?$/.test(v))
			return undefined;
		return eval('('+v+')');
	};

	$.parseJSON.safe = false;

})(jQuery);

