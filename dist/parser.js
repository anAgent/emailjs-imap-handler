'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function (buffers) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parser = new ParserInstance(buffers, options);
  var response = {};

  response.tag = parser.getTag();
  parser.getSpace();
  response.command = parser.getCommand();

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace();
    response.command += ' ' + parser.getElement((0, _formalSyntax.COMMAND)());
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace();
    response.attributes = parser.getAttributes();
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    });
  }

  return response;
};

var _formalSyntax = require('./formal-syntax');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ASCII_NL = 10;
var ASCII_CR = 13;
var ASCII_SPACE = 32;
var ASCII_LEFT_BRACKET = 91;
var ASCII_RIGHT_BRACKET = 93;

function fromCharCode(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    switch (c >> 4) {
      case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode((c & 0x1F) << 6 | char2 & 0x3F);
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode((c & 0x0F) << 12 | (char2 & 0x3F) << 6 | (char3 & 0x3F) << 0);
        break;
    }
  }

  return out;
}

function fromCharCodeTrimmed(uint8Array) {
  var begin = 0;
  var end = uint8Array.length;

  while (uint8Array[begin] === ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== ASCII_SPACE) {
      return false;
    }
  }

  return true;
}

var ParserInstance = function () {
  function ParserInstance(input, options) {
    _classCallCheck(this, ParserInstance);

    this.remainder = new Uint8Array(input || 0);
    this.options = options || {};
    this.pos = 0;
  }

  _createClass(ParserInstance, [{
    key: 'getTag',
    value: function getTag() {
      if (!this.tag) {
        this.tag = this.getElement((0, _formalSyntax.TAG)() + '*+', true);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement((0, _formalSyntax.COMMAND)());
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          var lastRightBracket = this.remainder.lastIndexOf(ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === ASCII_LEFT_BRACKET && lastRightBracket > 1) {
            this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1));
            this.remainder = this.remainder.subarray(0, lastRightBracket + 1);
          } else {
            this.humanReadable = fromCharCodeTrimmed(this.remainder);
            this.remainder = new Uint8Array(0);
          }
          break;
      }

      return this.command;
    }
  }, {
    key: 'getElement',
    value: function getElement(syntax) {
      var element = void 0;
      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = fromCharCode(this.remainder);
        } else {
          element = fromCharCode(this.remainder.subarray(0, firstSpace));
        }

        var errPos = (0, _formalSyntax.verify)(element, syntax);
        if (errPos >= 0) {
          throw new Error('Unexpected char at position ' + (this.pos + errPos));
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return element;
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if ((0, _formalSyntax.verify)(String.fromCharCode(this.remainder[0]), (0, _formalSyntax.SP)()) >= 0) {
        throw new Error('Unexpected char at position ' + this.pos);
      }

      this.pos++;
      this.remainder = this.remainder.subarray(1);
    }
  }, {
    key: 'getAttributes',
    value: function getAttributes() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes();
    }
  }]);

  return ParserInstance;
}();

var Node = function () {
  function Node(uint8Array, parentNode, startPos) {
    _classCallCheck(this, Node);

    this.uint8Array = uint8Array;
    this.childNodes = [];
    this.type = false;
    this.closed = true;
    this.valueSkip = [];
    this.startPos = startPos;
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0;

    if (parentNode) {
      this.parentNode = parentNode;
      parentNode.childNodes.push(this);
    }
  }

  _createClass(Node, [{
    key: 'getValue',
    value: function getValue() {
      var value = fromCharCode(this.getValueArray());
      return this.valueToUpperCase ? value.toUpperCase() : value;
    }
  }, {
    key: 'getValueLength',
    value: function getValueLength() {
      return this.valueEnd - this.valueStart - this.valueSkip.length;
    }
  }, {
    key: 'getValueArray',
    value: function getValueArray() {
      var valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd);

      if (this.valueSkip.length === 0) {
        return valueArray;
      }

      var filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length);
      var begin = 0;
      var offset = 0;
      var skip = this.valueSkip.slice();

      skip.push(valueArray.length);

      skip.forEach(function (end) {
        if (end > begin) {
          var subArray = valueArray.subarray(begin, end);
          filteredArray.set(subArray, offset);
          offset += subArray.length;
        }
        begin = end + 1;
      });

      return filteredArray;
    }
  }, {
    key: 'equals',
    value: function equals(value, caseSensitive) {
      if (this.getValueLength() !== value.length) {
        return false;
      }

      return this.equalsAt(value, 0, caseSensitive);
    }
  }, {
    key: 'equalsAt',
    value: function equalsAt(value, index, caseSensitive) {
      caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true;

      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;
      }

      for (var i = 0; i < value.length; i++) {
        while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
          index++;
        }

        if (index >= this.valueEnd) {
          return false;
        }

        var uint8Char = String.fromCharCode(this.uint8Array[index]);
        var char = value[i];

        if (!caseSensitive) {
          uint8Char = uint8Char.toUpperCase();
          char = char.toUpperCase();
        }

        if (uint8Char !== char) {
          return false;
        }

        index++;
      }

      return true;
    }
  }, {
    key: 'isNumber',
    value: function isNumber() {
      for (var i = 0; i < this.valueEnd - this.valueStart; i++) {
        if (this.valueSkip.indexOf(i) >= 0) {
          continue;
        }

        if (!this.isDigit(i)) {
          return false;
        }
      }

      return true;
    }
  }, {
    key: 'isDigit',
    value: function isDigit(index) {
      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index++;
        }
      }

      var ascii = this.uint8Array[index];
      return ascii >= 48 && ascii <= 57;
    }
  }, {
    key: 'containsChar',
    value: function containsChar(char) {
      var ascii = char.charCodeAt(0);

      for (var i = this.valueStart; i < this.valueEnd; i++) {
        if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
          continue;
        }

        if (this.uint8Array[i] === ascii) {
          return true;
        }
      }

      return false;
    }
  }]);

  return Node;
}();

var TokenParser = function () {
  function TokenParser(parent, startPos, uint8Array) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, TokenParser);

    this.uint8Array = uint8Array;
    this.options = options;
    this.parent = parent;

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = 'TREE';

    this.state = 'NORMAL';

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true;
    }

    this.processString();
  }

  _createClass(TokenParser, [{
    key: 'getAttributes',
    value: function getAttributes() {
      var _this = this;

      var attributes = [];
      var branch = attributes;

      var walk = function walk(node) {
        var elm = void 0;
        var curBranch = branch;
        var partial = void 0;

        if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
          node.closed = true;
          node.type = 'ATOM';
        }

        // If the node was never closed, throw it
        if (!node.closed) {
          throw new Error('Unexpected end of input at position ' + (_this.pos + _this.uint8Array.length - 1));
        }

        switch (node.type.toUpperCase()) {
          case 'LITERAL':
          case 'STRING':
            elm = {
              type: node.type.toUpperCase(),
              value: _this.options.valueAsString ? node.getValue() : node.getValueArray()
            };
            branch.push(elm);
            break;
          case 'SEQUENCE':
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'ATOM':
            if (node.equals('NIL', true)) {
              branch.push(null);
              break;
            }
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'SECTION':
            branch = branch[branch.length - 1].section = [];
            break;
          case 'LIST':
            elm = [];
            branch.push(elm);
            branch = elm;
            break;
          case 'PARTIAL':
            partial = node.getValue().split('.').map(Number);
            branch[branch.length - 1].partial = partial;
            break;
        }

        node.childNodes.forEach(function (childNode) {
          walk(childNode);
        });
        branch = curBranch;
      };

      walk(this.tree);

      return attributes;
    }
  }, {
    key: 'createNode',
    value: function createNode(parentNode, startPos) {
      return new Node(this.uint8Array, parentNode, startPos);
    }
  }, {
    key: 'processString',
    value: function processString() {
      var _this2 = this;

      var i = void 0;
      var len = void 0;
      var checkSP = function checkSP(pos) {
        // jump to the next non whitespace pos
        while (_this2.uint8Array[i + 1] === ' ') {
          i++;
        }
      };

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = String.fromCharCode(this.uint8Array[i]);

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case '"':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case '(':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case ')':
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case ']':
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case '<':
                if (String.fromCharCode(this.uint8Array[i - 1]) !== ']') {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';
                  this.currentNode.valueStart = i;
                  this.currentNode.valueEnd = i + 1;
                  this.state = 'ATOM';
                } else {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'PARTIAL';
                  this.state = 'PARTIAL';
                  this.currentNode.closed = false;
                }
                break;

              // { starts a new literal
              case '{':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case '*':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case ' ':
                // just ignore
                break;

              // [ starts section
              case '[':
                // If it is the *first* element after response command, then process as a response argument list
                if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                  this.currentNode.endPos = this.pos + i;

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'SECTION';
                  this.currentNode.closed = false;
                  this.state = 'NORMAL';

                  // RFC2221 defines a response code REFERRAL whose payload is an
                  // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                  // fail quite badly at parsing.  Since the imapurl is such a unique
                  // (and crazy) term, we just specialize that case here.
                  if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                    // create the REFERRAL atom
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                    this.currentNode.type = 'ATOM';
                    this.currentNode.endPos = this.pos + i + 8;
                    this.currentNode.valueStart = i + 1;
                    this.currentNode.valueEnd = i + 9;
                    this.currentNode.valueToUpperCase = true;
                    this.currentNode = this.currentNode.parentNode;

                    // eat all the way through the ] to be the  IMAPURL token.
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                    // just call this an ATOM, even though IMAPURL might be more correct
                    this.currentNode.type = 'ATOM';
                    // jump i to the ']'
                    i = this.uint8Array.indexOf(ASCII_RIGHT_BRACKET, i + 10);
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode.valueStart = this.currentNode.startPos - this.pos;
                    this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1;
                    this.currentNode = this.currentNode.parentNode;

                    // close out the SECTION
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    checkSP();
                  }

                  break;
                }
              /* falls through */
              default:
                // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                // Allow \ as the first char for atom to support system flags
                // Allow % to support LIST '' %
                if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                  throw new Error('Unexpected char at position ' + (this.pos + i));
                }

                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'ATOM';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.state = 'ATOM';
                break;
            }
            break;

          case 'ATOM':

            // space finishes an atom
            if (chr === ' ') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === ')' && this.currentNode.parentNode.type === 'LIST' || chr === ']' && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === ',' || chr === ':') && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === '[' && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === '<') {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible, throw. Allow \* as an exception
            if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === '"') {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === '\\') {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = String.fromCharCode(this.uint8Array[i]);
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === '>') {
              if (this.currentNode.equalsAt('.', -1)) {
                throw new Error('Unexpected end of partial at position ' + this.pos);
              }
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              checkSP();
              break;
            }

            if (chr === '.' && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0 && chr !== '.') {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== '.' && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
              if (chr === '\0') {
                throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
              }
              this.currentNode.valueEnd = i + 1;

              if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }

            if (chr === '+' && this.options.literalPlus) {
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === '}') {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === ASCII_CR && this.uint8Array[i + 2] === ASCII_NL) {
                i += 2;
              } else {
                throw new Error('Unexpected char at position ' + (this.pos + i));
              }
              this.currentNode.valueStart = i + 1;
              this.currentNode.literalLength = Number(this.currentNode.literalLength);
              this.currentNode.started = true;

              if (!this.currentNode.literalLength) {
                // special case where literal content length is 0
                // close the node right away, do not wait for additional input
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }
            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr;
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === ' ') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            } else if (this.currentNode.parentNode && chr === ']' && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === ':') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === '*') {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === ',') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!/\d/.test(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (/\d/.test(chr) && this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected number at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;
        }
      }
    }
  }]);

  return TokenParser;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJpc0VtcHR5IiwicmVtYWluZGVyIiwiYXR0cmlidXRlcyIsImdldEF0dHJpYnV0ZXMiLCJodW1hblJlYWRhYmxlIiwiY29uY2F0IiwidHlwZSIsInZhbHVlIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiIsIkFTQ0lJX1NQQUNFIiwiQVNDSUlfTEVGVF9CUkFDS0VUIiwiQVNDSUlfUklHSFRfQlJBQ0tFVCIsImZyb21DaGFyQ29kZSIsImFycmF5Iiwib3V0IiwiaSIsImxlbiIsImMiLCJjaGFyMiIsImNoYXIzIiwibGVuZ3RoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlVHJpbW1lZCIsInVpbnQ4QXJyYXkiLCJiZWdpbiIsImVuZCIsInN1YmFycmF5IiwiaW5wdXQiLCJVaW50OEFycmF5IiwicG9zIiwidG9TdHJpbmciLCJsYXN0UmlnaHRCcmFja2V0IiwibGFzdEluZGV4T2YiLCJzeW50YXgiLCJlbGVtZW50IiwiRXJyb3IiLCJmaXJzdFNwYWNlIiwiZXJyUG9zIiwiVG9rZW5QYXJzZXIiLCJOb2RlIiwicGFyZW50Tm9kZSIsInN0YXJ0UG9zIiwiY2hpbGROb2RlcyIsImNsb3NlZCIsInZhbHVlU2tpcCIsInZhbHVlU3RhcnQiLCJ2YWx1ZUVuZCIsInB1c2giLCJnZXRWYWx1ZUFycmF5IiwidmFsdWVUb1VwcGVyQ2FzZSIsInZhbHVlQXJyYXkiLCJmaWx0ZXJlZEFycmF5Iiwib2Zmc2V0Iiwic2tpcCIsInNsaWNlIiwiZm9yRWFjaCIsInN1YkFycmF5Iiwic2V0IiwiY2FzZVNlbnNpdGl2ZSIsImdldFZhbHVlTGVuZ3RoIiwiZXF1YWxzQXQiLCJpbmRleCIsInVpbnQ4Q2hhciIsImNoYXIiLCJpc0RpZ2l0IiwiYXNjaWkiLCJjaGFyQ29kZUF0IiwicGFyZW50IiwidHJlZSIsImN1cnJlbnROb2RlIiwiY3JlYXRlTm9kZSIsInN0YXRlIiwidmFsdWVBc1N0cmluZyIsInVuZGVmaW5lZCIsInByb2Nlc3NTdHJpbmciLCJicmFuY2giLCJ3YWxrIiwiZWxtIiwiY3VyQnJhbmNoIiwicGFydGlhbCIsIm5vZGUiLCJlcXVhbHMiLCJnZXRWYWx1ZSIsInNlY3Rpb24iLCJzcGxpdCIsIm1hcCIsIk51bWJlciIsImNoaWxkTm9kZSIsImNoZWNrU1AiLCJjaHIiLCJlbmRQb3MiLCJpc051bWJlciIsImNvbnRhaW5zQ2hhciIsInN0YXJ0ZWQiLCJsaXRlcmFsTGVuZ3RoIiwibGl0ZXJhbFBsdXMiLCJ0ZXN0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztrQkF3eUJlLFVBQVVBLE9BQVYsRUFBaUM7QUFBQSxNQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQzlDLE1BQUlDLFNBQVMsSUFBSUMsY0FBSixDQUFtQkgsT0FBbkIsRUFBNEJDLE9BQTVCLENBQWI7QUFDQSxNQUFJRyxXQUFXLEVBQWY7O0FBRUFBLFdBQVNDLEdBQVQsR0FBZUgsT0FBT0ksTUFBUCxFQUFmO0FBQ0FKLFNBQU9LLFFBQVA7QUFDQUgsV0FBU0ksT0FBVCxHQUFtQk4sT0FBT08sVUFBUCxFQUFuQjs7QUFFQSxNQUFJLENBQUMsS0FBRCxFQUFRLGNBQVIsRUFBd0JDLE9BQXhCLENBQWdDLENBQUNOLFNBQVNJLE9BQVQsSUFBb0IsRUFBckIsRUFBeUJHLFdBQXpCLEVBQWhDLEtBQTJFLENBQS9FLEVBQWtGO0FBQ2hGVCxXQUFPSyxRQUFQO0FBQ0FILGFBQVNJLE9BQVQsSUFBb0IsTUFBTU4sT0FBT1UsVUFBUCxDQUFrQiw0QkFBbEIsQ0FBMUI7QUFDRDs7QUFFRCxNQUFJLENBQUNDLFFBQVFYLE9BQU9ZLFNBQWYsQ0FBTCxFQUFnQztBQUM5QlosV0FBT0ssUUFBUDtBQUNBSCxhQUFTVyxVQUFULEdBQXNCYixPQUFP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MEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUF0QyxFQUEwRTtBQUN4RSxzQkFBTSxJQUFJekIsS0FBSixDQUFVLGtEQUFrRCxLQUFLTixHQUFMLEdBQVdkLENBQTdELENBQVYsQ0FBTjtBQUNEO0FBQ0Qsa0JBQUksS0FBS3NELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl6QixLQUFKLENBQVUsa0RBQWtELEtBQUtOLEdBQUwsR0FBV2QsQ0FBN0QsQ0FBVixDQUFOO0FBQ0Q7QUFDRixhQVBNLE1BT0EsSUFBSSxDQUFDLEtBQUtpRixJQUFMLENBQVVQLEdBQVYsQ0FBTCxFQUFxQjtBQUMxQixvQkFBTSxJQUFJdEQsS0FBSixDQUFVLGtDQUFrQyxLQUFLTixHQUFMLEdBQVdkLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELGdCQUFJLEtBQUtpRixJQUFMLENBQVVQLEdBQVYsS0FBa0IsS0FBS3BCLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEIsRUFBMEQ7QUFDeEQsb0JBQU0sSUFBSXpCLEtBQUosQ0FBVSxvQ0FBb0MsS0FBS04sR0FBTCxHQUFXZCxDQUEvQyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBS3NELFdBQUwsQ0FBaUJ2QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTtBQTNYSjtBQTZYRDtBQUNGIiwiZmlsZSI6InBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIFNQLCBESUdJVCwgQVRPTV9DSEFSLFxuICBUQUcsIENPTU1BTkQsIHZlcmlmeVxufSBmcm9tICcuL2Zvcm1hbC1zeW50YXgnXG5cbmxldCBBU0NJSV9OTCA9IDEwXG5sZXQgQVNDSUlfQ1IgPSAxM1xubGV0IEFTQ0lJX1NQQUNFID0gMzJcbmxldCBBU0NJSV9MRUZUX0JSQUNLRVQgPSA5MVxubGV0IEFTQ0lJX1JJR0hUX0JSQUNLRVQgPSA5M1xuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGUgKGFycmF5KSB7XG4gIHZhciBvdXQsIGksIGxlbiwgYztcbiAgdmFyIGNoYXIyLCBjaGFyMztcblxuICBvdXQgPSBcIlwiO1xuICBsZW4gPSBhcnJheS5sZW5ndGg7XG4gIGkgPSAwO1xuICB3aGlsZShpIDwgbGVuKSB7XG4gICAgYyA9IGFycmF5W2krK107XG4gICAgc3dpdGNoKGMgPj4gNClcbiAgICB7XG4gICAgICBjYXNlIDA6IGNhc2UgMTogY2FzZSAyOiBjYXNlIDM6IGNhc2UgNDogY2FzZSA1OiBjYXNlIDY6IGNhc2UgNzpcbiAgICAgICAgLy8gMHh4eHh4eHhcbiAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxMjogY2FzZSAxMzpcbiAgICAgICAgLy8gMTEweCB4eHh4ICAgMTB4eCB4eHh4XG4gICAgICAgIGNoYXIyID0gYXJyYXlbaSsrXTtcbiAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKChjICYgMHgxRikgPDwgNikgfCAoY2hhcjIgJiAweDNGKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxNDpcbiAgICAgICAgLy8gMTExMCB4eHh4ICAxMHh4IHh4eHggIDEweHggeHh4eFxuICAgICAgICBjaGFyMiA9IGFycmF5W2krK107XG4gICAgICAgIGNoYXIzID0gYXJyYXlbaSsrXTtcbiAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKChjICYgMHgwRikgPDwgMTIpIHxcbiAgICAgICAgICAgICAgICAgICAgICAgKChjaGFyMiAmIDB4M0YpIDw8IDYpIHxcbiAgICAgICAgICAgICAgICAgICAgICAgKChjaGFyMyAmIDB4M0YpIDw8IDApKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZnJvbUNoYXJDb2RlVHJpbW1lZCAodWludDhBcnJheSkge1xuICBsZXQgYmVnaW4gPSAwXG4gIGxldCBlbmQgPSB1aW50OEFycmF5Lmxlbmd0aFxuXG4gIHdoaWxlICh1aW50OEFycmF5W2JlZ2luXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICBiZWdpbisrXG4gIH1cblxuICB3aGlsZSAodWludDhBcnJheVtlbmQgLSAxXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICBlbmQtLVxuICB9XG5cbiAgaWYgKGJlZ2luICE9PSAwIHx8IGVuZCAhPT0gdWludDhBcnJheS5sZW5ndGgpIHtcbiAgICB1aW50OEFycmF5ID0gdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICB9XG5cbiAgcmV0dXJuIGZyb21DaGFyQ29kZSh1aW50OEFycmF5KVxufVxuXG5mdW5jdGlvbiBpc0VtcHR5ICh1aW50OEFycmF5KSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh1aW50OEFycmF5W2ldICE9PSBBU0NJSV9TUEFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuY2xhc3MgUGFyc2VySW5zdGFuY2Uge1xuICBjb25zdHJ1Y3RvciAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICB0aGlzLnJlbWFpbmRlciA9IG5ldyBVaW50OEFycmF5KGlucHV0IHx8IDApXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHRoaXMucG9zID0gMFxuICB9XG4gIGdldFRhZyAoKSB7XG4gICAgaWYgKCF0aGlzLnRhZykge1xuICAgICAgdGhpcy50YWcgPSB0aGlzLmdldEVsZW1lbnQoVEFHKCkgKyAnKisnLCB0cnVlKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy50YWdcbiAgfVxuXG4gIGdldENvbW1hbmQgKCkge1xuICAgIGlmICghdGhpcy5jb21tYW5kKSB7XG4gICAgICB0aGlzLmNvbW1hbmQgPSB0aGlzLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICAgIH1cblxuICAgIHN3aXRjaCAoKHRoaXMuY29tbWFuZCB8fCAnJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdPSyc6XG4gICAgICBjYXNlICdOTyc6XG4gICAgICBjYXNlICdCQUQnOlxuICAgICAgY2FzZSAnUFJFQVVUSCc6XG4gICAgICBjYXNlICdCWUUnOlxuICAgICAgICBsZXQgbGFzdFJpZ2h0QnJhY2tldCA9IHRoaXMucmVtYWluZGVyLmxhc3RJbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQpXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmRlclsxXSA9PT0gQVNDSUlfTEVGVF9CUkFDS0VUICYmIGxhc3RSaWdodEJyYWNrZXQgPiAxKSB7XG4gICAgICAgICAgdGhpcy5odW1hblJlYWRhYmxlID0gZnJvbUNoYXJDb2RlVHJpbW1lZCh0aGlzLnJlbWFpbmRlci5zdWJhcnJheShsYXN0UmlnaHRCcmFja2V0ICsgMSkpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgwLCBsYXN0UmlnaHRCcmFja2V0ICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyKVxuICAgICAgICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoMClcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNvbW1hbmRcbiAgfVxuXG4gIGdldEVsZW1lbnQgKHN5bnRheCkge1xuICAgIGxldCBlbGVtZW50XG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGxldCBmaXJzdFNwYWNlID0gdGhpcy5yZW1haW5kZXIuaW5kZXhPZihBU0NJSV9TUEFDRSlcbiAgICBpZiAodGhpcy5yZW1haW5kZXIubGVuZ3RoID4gMCAmJiBmaXJzdFNwYWNlICE9PSAwKSB7XG4gICAgICBpZiAoZmlyc3RTcGFjZSA9PT0gLTEpIHtcbiAgICAgICAgZWxlbWVudCA9IGZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlcilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsZW1lbnQgPSBmcm9tQ2hhckNvZGUodGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoMCwgZmlyc3RTcGFjZSkpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVyclBvcyA9IHZlcmlmeShlbGVtZW50LCBzeW50YXgpXG4gICAgICBpZiAoZXJyUG9zID49IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGVyclBvcykpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHRoaXMucG9zICs9IGVsZW1lbnQubGVuZ3RoXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheShlbGVtZW50Lmxlbmd0aClcblxuICAgIHJldHVybiBlbGVtZW50XG4gIH1cblxuICBnZXRTcGFjZSAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh2ZXJpZnkoU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlclswXSksIFNQKCkpID49IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcysrXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgxKVxuICB9XG5cbiAgZ2V0QXR0cmlidXRlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRva2VuUGFyc2VyKHRoaXMsIHRoaXMucG9zLCB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgpLCB0aGlzLm9wdGlvbnMpLmdldEF0dHJpYnV0ZXMoKVxuICB9XG59XG5cbmNsYXNzIE5vZGUge1xuICBjb25zdHJ1Y3RvciAodWludDhBcnJheSwgcGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5jaGlsZE5vZGVzID0gW11cbiAgICB0aGlzLnR5cGUgPSBmYWxzZVxuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZVxuICAgIHRoaXMudmFsdWVTa2lwID0gW11cbiAgICB0aGlzLnN0YXJ0UG9zID0gc3RhcnRQb3NcbiAgICB0aGlzLnZhbHVlU3RhcnQgPSB0aGlzLnZhbHVlRW5kID0gdHlwZW9mIHN0YXJ0UG9zID09PSAnbnVtYmVyJyA/IHN0YXJ0UG9zICsgMSA6IDBcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLnBhcmVudE5vZGUgPSBwYXJlbnROb2RlXG4gICAgICBwYXJlbnROb2RlLmNoaWxkTm9kZXMucHVzaCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIGdldFZhbHVlICgpIHtcbiAgICBsZXQgdmFsdWUgPSBmcm9tQ2hhckNvZGUodGhpcy5nZXRWYWx1ZUFycmF5KCkpXG4gICAgcmV0dXJuIHRoaXMudmFsdWVUb1VwcGVyQ2FzZSA/IHZhbHVlLnRvVXBwZXJDYXNlKCkgOiB2YWx1ZVxuICB9XG5cbiAgZ2V0VmFsdWVMZW5ndGggKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0IC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoXG4gIH1cblxuICBnZXRWYWx1ZUFycmF5ICgpIHtcbiAgICBjb25zdCB2YWx1ZUFycmF5ID0gdGhpcy51aW50OEFycmF5LnN1YmFycmF5KHRoaXMudmFsdWVTdGFydCwgdGhpcy52YWx1ZUVuZClcblxuICAgIGlmICh0aGlzLnZhbHVlU2tpcC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB2YWx1ZUFycmF5XG4gICAgfVxuXG4gICAgbGV0IGZpbHRlcmVkQXJyYXkgPSBuZXcgVWludDhBcnJheSh2YWx1ZUFycmF5Lmxlbmd0aCAtIHRoaXMudmFsdWVTa2lwLmxlbmd0aClcbiAgICBsZXQgYmVnaW4gPSAwXG4gICAgbGV0IG9mZnNldCA9IDBcbiAgICBsZXQgc2tpcCA9IHRoaXMudmFsdWVTa2lwLnNsaWNlKClcblxuICAgIHNraXAucHVzaCh2YWx1ZUFycmF5Lmxlbmd0aClcblxuICAgIHNraXAuZm9yRWFjaChmdW5jdGlvbiAoZW5kKSB7XG4gICAgICBpZiAoZW5kID4gYmVnaW4pIHtcbiAgICAgICAgdmFyIHN1YkFycmF5ID0gdmFsdWVBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICAgICAgICBmaWx0ZXJlZEFycmF5LnNldChzdWJBcnJheSwgb2Zmc2V0KVxuICAgICAgICBvZmZzZXQgKz0gc3ViQXJyYXkubGVuZ3RoXG4gICAgICB9XG4gICAgICBiZWdpbiA9IGVuZCArIDFcbiAgICB9KVxuXG4gICAgcmV0dXJuIGZpbHRlcmVkQXJyYXlcbiAgfVxuXG4gIGVxdWFscyAodmFsdWUsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICBpZiAodGhpcy5nZXRWYWx1ZUxlbmd0aCgpICE9PSB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVxdWFsc0F0KHZhbHVlLCAwLCBjYXNlU2Vuc2l0aXZlKVxuICB9XG5cbiAgZXF1YWxzQXQgKHZhbHVlLCBpbmRleCwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGNhc2VTZW5zaXRpdmUgPSB0eXBlb2YgY2FzZVNlbnNpdGl2ZSA9PT0gJ2Jvb2xlYW4nID8gY2FzZVNlbnNpdGl2ZSA6IHRydWVcblxuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGluZGV4IC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cblxuICAgICAgaWYgKGluZGV4ID49IHRoaXMudmFsdWVFbmQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGxldCB1aW50OENoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gICAgICBsZXQgY2hhciA9IHZhbHVlW2ldXG5cbiAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICB1aW50OENoYXIgPSB1aW50OENoYXIudG9VcHBlckNhc2UoKVxuICAgICAgICBjaGFyID0gY2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICB9XG5cbiAgICAgIGlmICh1aW50OENoYXIgIT09IGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGluZGV4KytcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaXNOdW1iZXIgKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52YWx1ZUVuZCAtIHRoaXMudmFsdWVTdGFydDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5pc0RpZ2l0KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc0RpZ2l0IChpbmRleCkge1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGFzY2lpID0gdGhpcy51aW50OEFycmF5W2luZGV4XVxuICAgIHJldHVybiBhc2NpaSA+PSA0OCAmJiBhc2NpaSA8PSA1N1xuICB9XG5cbiAgY29udGFpbnNDaGFyIChjaGFyKSB7XG4gICAgbGV0IGFzY2lpID0gY2hhci5jaGFyQ29kZUF0KDApXG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy52YWx1ZVN0YXJ0OyBpIDwgdGhpcy52YWx1ZUVuZDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpIC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnVpbnQ4QXJyYXlbaV0gPT09IGFzY2lpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuY2xhc3MgVG9rZW5QYXJzZXIge1xuICBjb25zdHJ1Y3RvciAocGFyZW50LCBzdGFydFBvcywgdWludDhBcnJheSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy51aW50OEFycmF5ID0gdWludDhBcnJheVxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnNcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudFxuXG4gICAgdGhpcy50cmVlID0gdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSgpXG4gICAgdGhpcy5wb3MgPSBzdGFydFBvcyB8fCAwXG5cbiAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnVFJFRSdcblxuICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID0gdHJ1ZVxuICAgIH1cblxuICAgIHRoaXMucHJvY2Vzc1N0cmluZygpXG4gIH1cblxuICBnZXRBdHRyaWJ1dGVzICgpIHtcbiAgICBsZXQgYXR0cmlidXRlcyA9IFtdXG4gICAgbGV0IGJyYW5jaCA9IGF0dHJpYnV0ZXNcblxuICAgIGxldCB3YWxrID0gbm9kZSA9PiB7XG4gICAgICBsZXQgZWxtXG4gICAgICBsZXQgY3VyQnJhbmNoID0gYnJhbmNoXG4gICAgICBsZXQgcGFydGlhbFxuXG4gICAgICBpZiAoIW5vZGUuY2xvc2VkICYmIG5vZGUudHlwZSA9PT0gJ1NFUVVFTkNFJyAmJiBub2RlLmVxdWFscygnKicpKSB7XG4gICAgICAgIG5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICBub2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIG5vZGUgd2FzIG5ldmVyIGNsb3NlZCwgdGhyb3cgaXRcbiAgICAgIGlmICghbm9kZS5jbG9zZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgdGhpcy51aW50OEFycmF5Lmxlbmd0aCAtIDEpKVxuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICAgIGNhc2UgJ0xJVEVSQUwnOlxuICAgICAgICBjYXNlICdTVFJJTkcnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID8gbm9kZS5nZXRWYWx1ZSgpIDogbm9kZS5nZXRWYWx1ZUFycmF5KClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ1NFUVVFTkNFJzpcbiAgICAgICAgICBlbG0gPSB7XG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgIHZhbHVlOiBub2RlLmdldFZhbHVlKClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0FUT00nOlxuICAgICAgICAgIGlmIChub2RlLmVxdWFscygnTklMJywgdHJ1ZSkpIHtcbiAgICAgICAgICAgIGJyYW5jaC5wdXNoKG51bGwpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbG0gPSB7XG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgIHZhbHVlOiBub2RlLmdldFZhbHVlKClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ1NFQ1RJT04nOlxuICAgICAgICAgIGJyYW5jaCA9IGJyYW5jaFticmFuY2gubGVuZ3RoIC0gMV0uc2VjdGlvbiA9IFtdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnTElTVCc6XG4gICAgICAgICAgZWxtID0gW11cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJhbmNoID0gZWxtXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgcGFydGlhbCA9IG5vZGUuZ2V0VmFsdWUoKS5zcGxpdCgnLicpLm1hcChOdW1iZXIpXG4gICAgICAgICAgYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5wYXJ0aWFsID0gcGFydGlhbFxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG5cbiAgICAgIG5vZGUuY2hpbGROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgd2FsayhjaGlsZE5vZGUpXG4gICAgICB9KVxuICAgICAgYnJhbmNoID0gY3VyQnJhbmNoXG4gICAgfVxuXG4gICAgd2Fsayh0aGlzLnRyZWUpXG5cbiAgICByZXR1cm4gYXR0cmlidXRlc1xuICB9XG5cbiAgY3JlYXRlTm9kZSAocGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICByZXR1cm4gbmV3IE5vZGUodGhpcy51aW50OEFycmF5LCBwYXJlbnROb2RlLCBzdGFydFBvcylcbiAgfVxuXG4gIHByb2Nlc3NTdHJpbmcgKCkge1xuICAgIGxldCBpXG4gICAgbGV0IGxlblxuICAgIGNvbnN0IGNoZWNrU1AgPSAocG9zKSA9PiB7XG4gICAgICAvLyBqdW1wIHRvIHRoZSBuZXh0IG5vbiB3aGl0ZXNwYWNlIHBvc1xuICAgICAgd2hpbGUgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09ICcgJykge1xuICAgICAgICBpKytcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwLCBsZW4gPSB0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGxldCBjaHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpXSlcblxuICAgICAgc3dpdGNoICh0aGlzLnN0YXRlKSB7XG4gICAgICAgIGNhc2UgJ05PUk1BTCc6XG5cbiAgICAgICAgICBzd2l0Y2ggKGNocikge1xuICAgICAgICAgICAgLy8gRFFVT1RFIHN0YXJ0cyBhIG5ldyBzdHJpbmdcbiAgICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnc3RyaW5nJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NUUklORydcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBsaXN0XG4gICAgICAgICAgICBjYXNlICcoJzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnTElTVCdcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyApIGNsb3NlcyBhIGxpc3RcbiAgICAgICAgICAgIGNhc2UgJyknOlxuICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS50eXBlICE9PSAnTElTVCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGlzdCB0ZXJtaW5hdG9yICkgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gXSBjbG9zZXMgc2VjdGlvbiBncm91cFxuICAgICAgICAgICAgY2FzZSAnXSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdTRUNUSU9OJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZWN0aW9uIHRlcm1pbmF0b3IgXSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIDwgc3RhcnRzIGEgbmV3IHBhcnRpYWxcbiAgICAgICAgICAgIGNhc2UgJzwnOlxuICAgICAgICAgICAgICBpZiAoU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXlbaSAtIDFdKSAhPT0gJ10nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ0FUT00nXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdQQVJUSUFMJ1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnUEFSVElBTCdcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8geyBzdGFydHMgYSBuZXcgbGl0ZXJhbFxuICAgICAgICAgICAgY2FzZSAneyc6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0xJVEVSQUwnXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTElURVJBTCdcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBzZXF1ZW5jZVxuICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIG5vcm1hbGx5IGEgc3BhY2Ugc2hvdWxkIG5ldmVyIG9jY3VyXG4gICAgICAgICAgICBjYXNlICcgJzpcbiAgICAgICAgICAgICAgLy8ganVzdCBpZ25vcmVcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gWyBzdGFydHMgc2VjdGlvblxuICAgICAgICAgICAgY2FzZSAnWyc6XG4gICAgICAgICAgICAgIC8vIElmIGl0IGlzIHRoZSAqZmlyc3QqIGVsZW1lbnQgYWZ0ZXIgcmVzcG9uc2UgY29tbWFuZCwgdGhlbiBwcm9jZXNzIGFzIGEgcmVzcG9uc2UgYXJndW1lbnQgbGlzdFxuICAgICAgICAgICAgICBpZiAoWydPSycsICdOTycsICdCQUQnLCAnQllFJywgJ1BSRUFVVEgnXS5pbmRleE9mKHRoaXMucGFyZW50LmNvbW1hbmQudG9VcHBlckNhc2UoKSkgPj0gMCAmJiB0aGlzLmN1cnJlbnROb2RlID09PSB0aGlzLnRyZWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRUNUSU9OJ1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgICAgIC8vIFJGQzIyMjEgZGVmaW5lcyBhIHJlc3BvbnNlIGNvZGUgUkVGRVJSQUwgd2hvc2UgcGF5bG9hZCBpcyBhblxuICAgICAgICAgICAgICAgIC8vIFJGQzIxOTIvUkZDNTA5MiBpbWFwdXJsIHRoYXQgd2Ugd2lsbCB0cnkgdG8gcGFyc2UgYXMgYW4gQVRPTSBidXRcbiAgICAgICAgICAgICAgICAvLyBmYWlsIHF1aXRlIGJhZGx5IGF0IHBhcnNpbmcuICBTaW5jZSB0aGUgaW1hcHVybCBpcyBzdWNoIGEgdW5pcXVlXG4gICAgICAgICAgICAgICAgLy8gKGFuZCBjcmF6eSkgdGVybSwgd2UganVzdCBzcGVjaWFsaXplIHRoYXQgY2FzZSBoZXJlLlxuICAgICAgICAgICAgICAgIGlmIChmcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5LnN1YmFycmF5KGkgKyAxLCBpICsgMTApKS50b1VwcGVyQ2FzZSgpID09PSAnUkVGRVJSQUwgJykge1xuICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBSRUZFUlJBTCBhdG9tXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIHRoaXMucG9zICsgaSArIDEpXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpICsgOFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgOVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVRvVXBwZXJDYXNlID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgICAgICAvLyBlYXQgYWxsIHRoZSB3YXkgdGhyb3VnaCB0aGUgXSB0byBiZSB0aGUgIElNQVBVUkwgdG9rZW4uXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIHRoaXMucG9zICsgaSArIDEwKVxuICAgICAgICAgICAgICAgICAgLy8ganVzdCBjYWxsIHRoaXMgYW4gQVRPTSwgZXZlbiB0aG91Z2ggSU1BUFVSTCBtaWdodCBiZSBtb3JlIGNvcnJlY3RcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICAgICAgLy8ganVtcCBpIHRvIHRoZSAnXSdcbiAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLnVpbnQ4QXJyYXkuaW5kZXhPZihBU0NJSV9SSUdIVF9CUkFDS0VULCBpICsgMTApXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IHRoaXMuY3VycmVudE5vZGUuc3RhcnRQb3MgLSB0aGlzLnBvc1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IHRoaXMuY3VycmVudE5vZGUuZW5kUG9zIC0gdGhpcy5wb3MgKyAxXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAgIC8vIGNsb3NlIG91dCB0aGUgU0VDVElPTlxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAvLyBBbnkgQVRPTSBzdXBwb3J0ZWQgY2hhciBzdGFydHMgYSBuZXcgQXRvbSBzZXF1ZW5jZSwgb3RoZXJ3aXNlIHRocm93IGFuIGVycm9yXG4gICAgICAgICAgICAgIC8vIEFsbG93IFxcIGFzIHRoZSBmaXJzdCBjaGFyIGZvciBhdG9tIHRvIHN1cHBvcnQgc3lzdGVtIGZsYWdzXG4gICAgICAgICAgICAgIC8vIEFsbG93ICUgdG8gc3VwcG9ydCBMSVNUICcnICVcbiAgICAgICAgICAgICAgaWYgKEFUT01fQ0hBUigpLmluZGV4T2YoY2hyKSA8IDAgJiYgY2hyICE9PSAnXFxcXCcgJiYgY2hyICE9PSAnJScpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ0FUT00nXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnQVRPTSc6XG5cbiAgICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyBhbiBhdG9tXG4gICAgICAgICAgaWYgKGNociA9PT0gJyAnKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvL1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAoY2hyID09PSAnKScgJiYgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLnR5cGUgPT09ICdMSVNUJykgfHxcbiAgICAgICAgICAgICAgKGNociA9PT0gJ10nICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoKGNociA9PT0gJywnIHx8IGNociA9PT0gJzonKSAmJiB0aGlzLmN1cnJlbnROb2RlLmlzTnVtYmVyKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBbIHN0YXJ0cyBhIHNlY3Rpb24gZ3JvdXAgZm9yIHRoaXMgZWxlbWVudFxuICAgICAgICAgIGlmIChjaHIgPT09ICdbJyAmJiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ0JPRFknLCBmYWxzZSkgfHwgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ0JPRFkuUEVFSycsIGZhbHNlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSwgdGhpcy5wb3MgKyBpKVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFQ1RJT04nXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociA9PT0gJzwnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc3RhcnQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gaWYgdGhlIGNoYXIgaXMgbm90IEFUT00gY29tcGF0aWJsZSwgdGhyb3cuIEFsbG93IFxcKiBhcyBhbiBleGNlcHRpb25cbiAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICddJyAmJiAhKGNociA9PT0gJyonICYmIHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnXFxcXConKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU1RSSU5HJzpcblxuICAgICAgICAgIC8vIERRVU9URSBlbmRzIHRoZSBzdHJpbmcgc2VxdWVuY2VcbiAgICAgICAgICBpZiAoY2hyID09PSAnXCInKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFxcIEVzY2FwZXMgdGhlIGZvbGxvd2luZyBjaGFyXG4gICAgICAgICAgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU2tpcC5wdXNoKGkgLSB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQpXG4gICAgICAgICAgICBpKytcbiAgICAgICAgICAgIGlmIChpID49IGxlbikge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2ldKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8qIC8vIHNraXAgdGhpcyBjaGVjaywgb3RoZXJ3aXNlIHRoZSBwYXJzZXIgbWlnaHQgZXhwbG9kZSBvbiBiaW5hcnkgaW5wdXRcbiAgICAgICAgICBpZiAoVEVYVF9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAqL1xuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBpZiAoY2hyID09PSAnPicpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnLicgJiYgKCF0aGlzLmN1cnJlbnROb2RlLmdldFZhbHVlTGVuZ3RoKCkgfHwgdGhpcy5jdXJyZW50Tm9kZS5jb250YWluc0NoYXIoJy4nKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBwYXJ0aWFsIHNlcGFyYXRvciAuIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwICYmIGNociAhPT0gJy4nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociAhPT0gJy4nICYmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnMCcpIHx8IHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJy4wJywgLTIpKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhcnRpYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuc3RhcnRlZCkge1xuICAgICAgICAgICAgaWYgKGNociA9PT0gJ1xcdTAwMDAnKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBcXFxceDAwIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpID49IHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICcrJyAmJiB0aGlzLm9wdGlvbnMubGl0ZXJhbFBsdXMpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbFBsdXMgPSB0cnVlXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICd9Jykge1xuICAgICAgICAgICAgaWYgKCEoJ2xpdGVyYWxMZW5ndGgnIGluIHRoaXMuY3VycmVudE5vZGUpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBsaXRlcmFsIHByZWZpeCBlbmQgY2hhciB9IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnVpbnQ4QXJyYXlbaSArIDFdID09PSBBU0NJSV9OTCkge1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfQ1IgJiYgdGhpcy51aW50OEFycmF5W2kgKyAyXSA9PT0gQVNDSUlfTkwpIHtcbiAgICAgICAgICAgICAgaSArPSAyXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpICsgMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID0gTnVtYmVyKHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aClcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuc3RhcnRlZCA9IHRydWVcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpIHtcbiAgICAgICAgICAgICAgLy8gc3BlY2lhbCBjYXNlIHdoZXJlIGxpdGVyYWwgY29udGVudCBsZW5ndGggaXMgMFxuICAgICAgICAgICAgICAvLyBjbG9zZSB0aGUgbm9kZSByaWdodCBhd2F5LCBkbyBub3Qgd2FpdCBmb3IgYWRkaXRpb25hbCBpbnB1dFxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPT09ICcwJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpdGVyYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoIHx8ICcnKSArIGNoclxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIC8vIHNwYWNlIGZpbmlzaGVzIHRoZSBzZXF1ZW5jZSBzZXRcbiAgICAgICAgICBpZiAoY2hyID09PSAnICcpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTIpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgY2hyID09PSAnXScgJiZcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICc6Jykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcqJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcsJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSB3aWxkY2FyZCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcsJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZXF1ZW5jZSBzZXBhcmF0b3IgLCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIS9cXGQvLnRlc3QoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgvXFxkLy50ZXN0KGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICB9XG5cbiAgaWYgKCFpc0VtcHR5KHBhcnNlci5yZW1haW5kZXIpKSB7XG4gICAgcGFyc2VyLmdldFNwYWNlKClcbiAgICByZXNwb25zZS5hdHRyaWJ1dGVzID0gcGFyc2VyLmdldEF0dHJpYnV0ZXMoKVxuICB9XG5cbiAgaWYgKHBhcnNlci5odW1hblJlYWRhYmxlKSB7XG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IChyZXNwb25zZS5hdHRyaWJ1dGVzIHx8IFtdKS5jb25jYXQoe1xuICAgICAgdHlwZTogJ1RFWFQnLFxuICAgICAgdmFsdWU6IHBhcnNlci5odW1hblJlYWRhYmxlXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuIl19