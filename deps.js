// esprima + escodegen.browser.js (registered to self instead of window) +
//   istanbul's Instrumenter.js (registered to self instead of window)

/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2013 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwErrorTolerant: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseUnaryExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.

    /* istanbul ignore next */
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
        NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        /* istanbul ignore if */
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
            (ch >= 0x1680 && [0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(ch) >= 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch >= 0x30 && ch <= 0x39) ||         // 0..9
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        default:
            return false;
        }
    }

    function isStrictModeReservedWord(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        default:
            return false;
        }
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        // 'const' is specialized as Keyword in V8.
        // 'yield' and 'let' are for compatiblity with SpiderMonkey and ES.next.
        // Some others are from future reserved words.

        switch (id.length) {
        case 2:
            return (id === 'if') || (id === 'in') || (id === 'do');
        case 3:
            return (id === 'var') || (id === 'for') || (id === 'new') ||
                (id === 'try') || (id === 'let');
        case 4:
            return (id === 'this') || (id === 'else') || (id === 'case') ||
                (id === 'void') || (id === 'with') || (id === 'enum');
        case 5:
            return (id === 'while') || (id === 'break') || (id === 'catch') ||
                (id === 'throw') || (id === 'const') || (id === 'yield') ||
                (id === 'class') || (id === 'super');
        case 6:
            return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                (id === 'switch') || (id === 'export') || (id === 'import');
        case 7:
            return (id === 'default') || (id === 'finally') || (id === 'extends');
        case 8:
            return (id === 'function') || (id === 'continue') || (id === 'debugger');
        case 10:
            return (id === 'instanceof');
        default:
            return false;
        }
    }

    // 7.4 Comments

    function addComment(type, value, start, end, loc) {
        var comment, attacher;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);
        if (extra.attachComment) {
            extra.leadingComments.push(comment);
            extra.trailingComments.push(comment);
        }
    }

    function skipSingleLineComment(offset) {
        var start, loc, ch, comment;

        start = index - offset;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart - offset
            }
        };

        while (index < length) {
            ch = source.charCodeAt(index);
            ++index;
            if (isLineTerminator(ch)) {
                if (extra.comments) {
                    comment = source.slice(start + offset, index - 1);
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    addComment('Line', comment, start, index - 1, loc);
                }
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                return;
            }
        }

        if (extra.comments) {
            comment = source.slice(start + offset, index);
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
            addComment('Line', comment, start, index, loc);
        }
    }

    function skipMultiLineComment() {
        var start, loc, ch, comment;

        if (extra.comments) {
            start = index - 2;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart - 2
                }
            };
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (isLineTerminator(ch)) {
                if (ch === 0x0D && source.charCodeAt(index + 1) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                ++index;
                lineStart = index;
                if (index >= length) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else if (ch === 0x2A) {
                // Block comment ends with '*/'.
                if (source.charCodeAt(index + 1) === 0x2F) {
                    ++index;
                    ++index;
                    if (extra.comments) {
                        comment = source.slice(start + 2, index - 2);
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        addComment('Block', comment, start, index, loc);
                    }
                    return;
                }
                ++index;
            } else {
                ++index;
            }
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function skipComment() {
        var ch, start;

        start = (index === 0);
        while (index < length) {
            ch = source.charCodeAt(index);

            if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 0x0D && source.charCodeAt(index) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                start = true;
            } else if (ch === 0x2F) { // U+002F is '/'
                ch = source.charCodeAt(index + 1);
                if (ch === 0x2F) {
                    ++index;
                    ++index;
                    skipSingleLineComment(2);
                    start = true;
                } else if (ch === 0x2A) {  // U+002A is '*'
                    ++index;
                    ++index;
                    skipMultiLineComment();
                } else {
                    break;
                }
            } else if (start && ch === 0x2D) { // U+002D is '-'
                // U+003E is '>'
                if ((source.charCodeAt(index + 1) === 0x2D) && (source.charCodeAt(index + 2) === 0x3E)) {
                    // '-->' is a single-line comment
                    index += 3;
                    skipSingleLineComment(3);
                } else {
                    break;
                }
            } else if (ch === 0x3C) { // U+003C is '<'
                if (source.slice(index + 1, index + 4) === '!--') {
                    ++index; // `<`
                    ++index; // `!`
                    ++index; // `-`
                    ++index; // `-`
                    skipSingleLineComment(4);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (U+005C, U+0075) denotes an escaped character.
        if (ch === 0x5C) {
            if (source.charCodeAt(index) !== 0x75) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (U+005C, U+0075) denotes an escaped character.
            if (ch === 0x5C) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 0x75) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 0x5C) {
                // Blackslash (U+005C) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (U+005C) starts an escaped character.
        id = (source.charCodeAt(index) === 0x5C) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {

        // Check for most common single-character punctuators.
        case 0x2E:  // . dot
        case 0x28:  // ( open bracket
        case 0x29:  // ) close bracket
        case 0x3B:  // ; semicolon
        case 0x2C:  // , comma
        case 0x7B:  // { open curly brace
        case 0x7D:  // } close curly brace
        case 0x5B:  // [
        case 0x5D:  // ]
        case 0x3A:  // :
        case 0x3F:  // ?
        case 0x7E:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 0x28) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 0x7B) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (U+003D) marks an assignment or comparison operator.
            if (code2 === 0x3D) {
                switch (code) {
                case 0x2B:  // +
                case 0x2D:  // -
                case 0x2F:  // /
                case 0x3C:  // <
                case 0x3E:  // >
                case 0x5E:  // ^
                case 0x7C:  // |
                case 0x25:  // %
                case 0x26:  // &
                case 0x2A:  // *
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        start: start,
                        end: index
                    };

                case 0x21: // !
                case 0x3D: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 0x3D) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        start: start,
                        end: index
                    };
                }
            }
        }

        // 4-character punctuator: >>>=

        ch4 = source.substr(index, 4);

        if (ch4 === '>>>=') {
            index += 4;
            return {
                type: Token.Punctuator,
                value: ch4,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // 3-character punctuators: === !== >>> <<= >>=

        ch3 = ch4.substr(0, 3);

        if (ch3 === '>>>' || ch3 === '<<=' || ch3 === '>>=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: ch3,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||
        ch2 = ch3.substr(0, 2);

        if ((ch1 === ch2[1] && ('+-<>&|'.indexOf(ch1) >= 0)) || ch2 === '=>') {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // 1-character punctuators: < > = ! + - * % & | ^ /
        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function scanOctalLiteral(start) {
        var number = '0' + source[index++];
        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: true,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (isOctalDigit(ch)) {
                    return scanOctalLiteral(start);
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false, startLineNumber, startLineStart;
        startLineNumber = lineNumber;
        startLineStart = lineStart;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            startLineNumber: startLineNumber,
            startLineStart: startLineStart,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function testRegExp(pattern, flags) {
        var value;
        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }
        return value;
    }

    function scanRegExpBody() {
        var ch, str, classMarker, terminated, body;

        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        classMarker = false;
        terminated = false;
        while (index < length) {
            ch = source[index++];
            str += ch;
            if (ch === '\\') {
                ch = source[index++];
                // ECMA-262 7.8.5
                if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
                str += ch;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                throwError({}, Messages.UnterminatedRegExp);
            } else if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        body = str.substr(1, str.length - 2);
        return {
            value: body,
            literal: str
        };
    }

    function scanRegExpFlags() {
        var ch, str, flags, restore;

        str = '';
        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                    throwErrorTolerant({}, Messages.UnexpectedToken, 'ILLEGAL');
                } else {
                    str += '\\';
                    throwErrorTolerant({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        return {
            value: flags,
            literal: str
        };
    }

    function scanRegExp() {
        var start, body, flags, pattern, value;

        lookahead = null;
        skipComment();
        start = index;

        body = scanRegExpBody();
        flags = scanRegExpFlags();
        value = testRegExp(body.value, flags.value);

        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        return {
            literal: body.literal + flags.literal,
            value: value,
            start: start,
            end: index
        };
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        /* istanbul ignore next */
        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return collectRegex();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ']') {
                return scanPunctuator();
            }
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return collectRegex();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return collectRegex();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return collectRegex();
            }
            return collectRegex();
        }
        if (prevToken.type === 'Keyword') {
            return collectRegex();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: index,
                end: index
            };
        }

        ch = source.charCodeAt(index);

        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Very common: ( and ) and ;
        if (ch === 0x28 || ch === 0x29 || ch === 0x3B) {
            return scanPunctuator();
        }

        // String literal starts with single quote (U+0027) or double quote (U+0022).
        if (ch === 0x27 || ch === 0x22) {
            return scanStringLiteral();
        }


        // Dot (.) U+002E can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 0x2E) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) U+002F can also start a regex.
        if (extra.tokenize && ch === 0x2F) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function collectToken() {
        var loc, token, range, value;

        skipComment();
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            value = source.slice(token.start, token.end);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: [token.start, token.end],
                loc: loc
            });
        }

        return token;
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.end;
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();

        index = token.end;
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    function Position(line, column) {
        this.line = line;
        this.column = column;
    }

    function SourceLocation(startLine, startColumn, line, column) {
        this.start = new Position(startLine, startColumn);
        this.end = new Position(line, column);
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        processComment: function (node) {
            var lastChild, trailingComments;

            if (node.type === Syntax.Program) {
                if (node.body.length > 0) {
                    return;
                }
            }

            if (extra.trailingComments.length > 0) {
                if (extra.trailingComments[0].range[0] >= node.range[1]) {
                    trailingComments = extra.trailingComments;
                    extra.trailingComments = [];
                } else {
                    extra.trailingComments.length = 0;
                }
            } else {
                if (extra.bottomRightStack.length > 0 &&
                        extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments &&
                        extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments[0].range[0] >= node.range[1]) {
                    trailingComments = extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments;
                    delete extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments;
                }
            }

            // Eating the stack.
            while (extra.bottomRightStack.length > 0 && extra.bottomRightStack[extra.bottomRightStack.length - 1].range[0] >= node.range[0]) {
                lastChild = extra.bottomRightStack.pop();
            }

            if (lastChild) {
                if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= node.range[0]) {
                    node.leadingComments = lastChild.leadingComments;
                    delete lastChild.leadingComments;
                }
            } else if (extra.leadingComments.length > 0 && extra.leadingComments[extra.leadingComments.length - 1].range[1] <= node.range[0]) {
                node.leadingComments = extra.leadingComments;
                extra.leadingComments = [];
            }


            if (trailingComments) {
                node.trailingComments = trailingComments;
            }

            extra.bottomRightStack.push(node);
        },

        markEnd: function (node, startToken) {
            if (extra.range) {
                node.range = [startToken.start, index];
            }
            if (extra.loc) {
                node.loc = new SourceLocation(
                    startToken.startLineNumber === undefined ?  startToken.lineNumber : startToken.startLineNumber,
                    startToken.start - (startToken.startLineStart === undefined ?  startToken.lineStart : startToken.startLineStart),
                    lineNumber,
                    index - lineStart
                );
                this.postProcess(node);
            }

            if (extra.attachComment) {
                this.processComment(node);
            }
            return node;
        },

        postProcess: function (node) {
            if (extra.source) {
                node.loc.source = extra.source;
            }
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBlockStatement: function (body) {
            return {
                type: Syntax.BlockStatement,
                body: body
            };
        },

        createBreakStatement: function (label) {
            return {
                type: Syntax.BreakStatement,
                label: label
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createCatchClause: function (param, body) {
            return {
                type: Syntax.CatchClause,
                param: param,
                body: body
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createContinueStatement: function (label) {
            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        },

        createDebuggerStatement: function () {
            return {
                type: Syntax.DebuggerStatement
            };
        },

        createDoWhileStatement: function (body, test) {
            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        },

        createEmptyStatement: function () {
            return {
                type: Syntax.EmptyStatement
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createForStatement: function (init, test, update, body) {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        },

        createForInStatement: function (left, right, body) {
            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        },

        createFunctionDeclaration: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createFunctionExpression: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name
            };
        },

        createIfStatement: function (test, consequent, alternate) {
            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createLabeledStatement: function (label, body) {
            return {
                type: Syntax.LabeledStatement,
                label: label,
                body: body
            };
        },

        createLiteral: function (token) {
            return {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.start, token.end)
            };
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProgram: function (body) {
            return {
                type: Syntax.Program,
                body: body
            };
        },

        createProperty: function (kind, key, value) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind
            };
        },

        createReturnStatement: function (argument) {
            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createSwitchCase: function (test, consequent) {
            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        },

        createSwitchStatement: function (discriminant, cases) {
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createThrowStatement: function (argument) {
            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        },

        createTryStatement: function (block, guardedHandlers, handlers, finalizer) {
            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: guardedHandlers,
                handlers: handlers,
                finalizer: finalizer
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        },

        createVariableDeclaration: function (declarations, kind) {
            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        },

        createVariableDeclarator: function (id, init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        },

        createWhileStatement: function (test, body) {
            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        },

        createWithStatement: function (object, body) {
            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        }
    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.start;
            error.lineNumber = token.lineNumber;
            error.column = token.start - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var line;

        // Catch the very common case first: immediately a semicolon (U+003B).
        if (source.charCodeAt(index) === 0x3B || match(';')) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [], startToken;

        startToken = lookahead;
        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        lex();

        return delegate.markEnd(delegate.createArrayExpression(elements), startToken);
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body, startToken;

        previousStrict = strict;
        startToken = lookahead;
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;
        return delegate.markEnd(delegate.createFunctionExpression(null, param, [], body), startToken);
    }

    function parseObjectPropertyKey() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return delegate.markEnd(delegate.createLiteral(token), startToken);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseObjectProperty() {
        var token, key, id, value, param, startToken;

        token = lookahead;
        startToken = lookahead;

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                value = parsePropertyFunction([]);
                return delegate.markEnd(delegate.createProperty('get', key, value), startToken);
            }
            if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead;
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    value = parsePropertyFunction([]);
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    value = parsePropertyFunction(param, token);
                }
                return delegate.markEnd(delegate.createProperty('set', key, value), startToken);
            }
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', id, value), startToken);
        }
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', key, value), startToken);
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String, startToken;

        startToken = lookahead;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

            key = '$' + name;
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                if (map[key] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[key] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[key] |= kind;
            } else {
                map[key] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return delegate.markEnd(delegate.createObjectExpression(properties), startToken);
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var type, token, expr, startToken;

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        type = lookahead.type;
        startToken = lookahead;

        if (type === Token.Identifier) {
            expr =  delegate.createIdentifier(lex().value);
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            expr = delegate.createLiteral(lex());
        } else if (type === Token.Keyword) {
            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }
            if (matchKeyword('this')) {
                lex();
                expr = delegate.createThisExpression();
            } else {
                throwUnexpected(lex());
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = delegate.createLiteral(token);
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = delegate.createLiteral(token);
        } else if (match('/') || match('/=')) {
            if (typeof extra.tokens !== 'undefined') {
                expr = delegate.createLiteral(collectRegex());
            } else {
                expr = delegate.createLiteral(scanRegExp());
            }
            peek();
        } else {
            throwUnexpected(lex());
        }

        return delegate.markEnd(expr, startToken);
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args, startToken;

        startToken = lookahead;
        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return delegate.markEnd(delegate.createNewExpression(callee, args), startToken);
    }

    function parseLeftHandSideExpressionAllowCall() {
        var previousAllowIn, expr, args, property, startToken;

        startToken = lookahead;

        previousAllowIn = state.allowIn;
        state.allowIn = true;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        for (;;) {
            if (match('.')) {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            } else if (match('(')) {
                args = parseArguments();
                expr = delegate.createCallExpression(expr, args);
            } else if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                break;
            }
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var previousAllowIn, expr, property, startToken;

        startToken = lookahead;

        previousAllowIn = state.allowIn;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        while (match('.') || match('[')) {
            if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr, token, startToken = lookahead;

        expr = parseLeftHandSideExpressionAllowCall();

        if (lookahead.type === Token.Punctuator) {
            if ((match('++') || match('--')) && !peekLineTerminator()) {
                // 11.3.1, 11.3.2
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwErrorTolerant({}, Messages.StrictLHSPostfix);
                }

                if (!isLeftHandSide(expr)) {
                    throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
                }

                token = lex();
                expr = delegate.markEnd(delegate.createPostfixExpression(token.value, expr), startToken);
            }
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr, startToken;

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
        } else if (match('++') || match('--')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
        } else if (match('+') || match('-') || match('~') || match('!')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
        } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
        } else {
            expr = parsePostfixExpression();
        }

        return expr;
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var marker, markers, expr, token, prec, stack, right, operator, left, i;

        marker = lookahead;
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, state.allowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, lookahead];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, state.allowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers[markers.length - 1];
                delegate.markEnd(expr, marker);
                stack.push(expr);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(lookahead);
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            delegate.markEnd(expr, marker);
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate, startToken;

        startToken = lookahead;

        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = delegate.createConditionalExpression(expr, consequent, alternate);
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, left, right, node, startToken;

        token = lookahead;
        startToken = lookahead;

        node = left = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(left)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && left.type === Syntax.Identifier && isRestrictedWord(left.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            token = lex();
            right = parseAssignmentExpression();
            node = delegate.markEnd(delegate.createAssignmentExpression(token.value, left, right), startToken);
        }

        return node;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr, startToken = lookahead;

        expr = parseAssignmentExpression();

        if (match(',')) {
            expr = delegate.createSequenceExpression([ expr ]);

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }

            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block, startToken;

        startToken = lookahead;
        expect('{');

        block = parseStatementList();

        expect('}');

        return delegate.markEnd(delegate.createBlockStatement(block), startToken);
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseVariableDeclaration(kind) {
        var init = null, id, startToken;

        startToken = lookahead;
        id = parseVariableIdentifier();

        // 12.2.1
        if (strict && isRestrictedWord(id.name)) {
            throwErrorTolerant({}, Messages.StrictVarName);
        }

        if (kind === 'const') {
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return delegate.markEnd(delegate.createVariableDeclarator(id, init), startToken);
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations;

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return delegate.createVariableDeclaration(declarations, 'var');
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations, startToken;

        startToken = lookahead;

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, kind), startToken);
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        expect(';');
        return delegate.createEmptyStatement();
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();
        consumeSemicolon();
        return delegate.createExpressionStatement(expr);
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate;

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return delegate.createIfStatement(test, consequent, alternate);
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration;

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return delegate.createDoWhileStatement(body, test);
    }

    function parseWhileStatement() {
        var test, body, oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return delegate.createWhileStatement(test, body);
    }

    function parseForVariableDeclaration() {
        var token, declarations, startToken;

        startToken = lookahead;
        token = lex();
        declarations = parseVariableDeclarationList();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, token.value), startToken);
    }

    function parseForStatement() {
        var init, test, update, left, right, body, oldInIteration;

        init = test = update = null;

        expectKeyword('for');

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1 && matchKeyword('in')) {
                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isLeftHandSide(init)) {
                        throwErrorTolerant({}, Messages.InvalidLHSInForIn);
                    }

                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return (typeof left === 'undefined') ?
                delegate.createForStatement(init, test, update, body) :
                delegate.createForInStatement(left, right, body);
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var label = null, key;

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source.charCodeAt(index) === 0x3B) {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return delegate.createContinueStatement(label);
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var label = null, key;

        expectKeyword('break');

        // Catch the very common case first: immediately a semicolon (U+003B).
        if (source.charCodeAt(index) === 0x3B) {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return delegate.createBreakStatement(label);
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var argument = null;

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source.charCodeAt(index) === 0x20) {
            if (isIdentifierStart(source.charCodeAt(index + 1))) {
                argument = parseExpression();
                consumeSemicolon();
                return delegate.createReturnStatement(argument);
            }
        }

        if (peekLineTerminator()) {
            return delegate.createReturnStatement(null);
        }

        if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return delegate.createReturnStatement(argument);
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body;

        if (strict) {
            // TODO(ikarienator): Should we update the test cases instead?
            skipComment();
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return delegate.createWithStatement(object, body);
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test, consequent = [], statement, startToken;

        startToken = lookahead;
        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            statement = parseStatement();
            consequent.push(statement);
        }

        return delegate.markEnd(delegate.createSwitchCase(test, consequent), startToken);
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound;

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        cases = [];

        if (match('}')) {
            lex();
            return delegate.createSwitchStatement(discriminant, cases);
        }

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return delegate.createSwitchStatement(discriminant, cases);
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument;

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return delegate.createThrowStatement(argument);
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param, body, startToken;

        startToken = lookahead;
        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead);
        }

        param = parseVariableIdentifier();
        // 12.14.1
        if (strict && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');
        body = parseBlock();
        return delegate.markEnd(delegate.createCatchClause(param, body), startToken);
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null;

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return delegate.createTryStatement(block, [], handlers, finalizer);
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        expectKeyword('debugger');

        consumeSemicolon();

        return delegate.createDebuggerStatement();
    }

    // 12 Statements

    function parseStatement() {
        var type = lookahead.type,
            expr,
            labeledBody,
            key,
            startToken;

        if (type === Token.EOF) {
            throwUnexpected(lookahead);
        }

        if (type === Token.Punctuator && lookahead.value === '{') {
            return parseBlock();
        }

        startToken = lookahead;

        if (type === Token.Punctuator) {
            switch (lookahead.value) {
            case ';':
                return delegate.markEnd(parseEmptyStatement(), startToken);
            case '(':
                return delegate.markEnd(parseExpressionStatement(), startToken);
            default:
                break;
            }
        }

        if (type === Token.Keyword) {
            switch (lookahead.value) {
            case 'break':
                return delegate.markEnd(parseBreakStatement(), startToken);
            case 'continue':
                return delegate.markEnd(parseContinueStatement(), startToken);
            case 'debugger':
                return delegate.markEnd(parseDebuggerStatement(), startToken);
            case 'do':
                return delegate.markEnd(parseDoWhileStatement(), startToken);
            case 'for':
                return delegate.markEnd(parseForStatement(), startToken);
            case 'function':
                return delegate.markEnd(parseFunctionDeclaration(), startToken);
            case 'if':
                return delegate.markEnd(parseIfStatement(), startToken);
            case 'return':
                return delegate.markEnd(parseReturnStatement(), startToken);
            case 'switch':
                return delegate.markEnd(parseSwitchStatement(), startToken);
            case 'throw':
                return delegate.markEnd(parseThrowStatement(), startToken);
            case 'try':
                return delegate.markEnd(parseTryStatement(), startToken);
            case 'var':
                return delegate.markEnd(parseVariableStatement(), startToken);
            case 'while':
                return delegate.markEnd(parseWhileStatement(), startToken);
            case 'with':
                return delegate.markEnd(parseWithStatement(), startToken);
            default:
                break;
            }
        }

        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return delegate.markEnd(delegate.createLabeledStatement(expr, labeledBody), startToken);
        }

        consumeSemicolon();

        return delegate.markEnd(delegate.createExpressionStatement(expr), startToken);
    }

    // 13 Function Definition

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody, startToken;

        startToken = lookahead;
        expect('{');

        while (index < length) {
            if (lookahead.type !== Token.StringLiteral) {
                break;
            }
            token = lookahead;

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;

        return delegate.markEnd(delegate.createBlockStatement(sourceElements), startToken);
    }

    function parseParams(firstRestricted) {
        var param, params = [], token, stricted, paramSet, key, message;
        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead;
                param = parseVariableIdentifier();
                key = '$' + token.value;
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[key] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return {
            params: params,
            stricted: stricted,
            firstRestricted: firstRestricted,
            message: message
        };
    }

    function parseFunctionDeclaration() {
        var id, params = [], body, token, stricted, tmp, firstRestricted, message, previousStrict, startToken;

        startToken = lookahead;

        expectKeyword('function');
        token = lookahead;
        id = parseVariableIdentifier();
        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionDeclaration(id, params, [], body), startToken);
    }

    function parseFunctionExpression() {
        var token, id = null, stricted, firstRestricted, message, tmp, params = [], body, previousStrict, startToken;

        startToken = lookahead;
        expectKeyword('function');

        if (!match('(')) {
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionExpression(id, params, [], body), startToken);
    }

    // 14 Program

    function parseSourceElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(lookahead.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (lookahead.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseSourceElement();
            /* istanbul ignore if */
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var body, startToken;

        skipComment();
        peek();
        startToken = lookahead;
        strict = false;

        body = parseSourceElements();
        return delegate.markEnd(delegate.createProgram(body), startToken);
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                extra.source = toString(options.source);
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
            if (extra.attachComment) {
                extra.range = true;
                extra.comments = [];
                extra.bottomRightStack = [];
                extra.trailingComments = [];
                extra.leadingComments = [];
            }
        }

        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }

        return program;
    }

    // Sync with *.json manifests.
    exports.version = '1.2.2';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
   /* istanbul ignore next */
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

// Generated by browserify
(function() {
    var require = function(file, cwd) {
        var resolved = require.resolve(file, cwd || '/');
        var mod = require.modules[resolved];
        if (!mod) throw new Error(
            'Failed to resolve module ' + file + ', tried ' + resolved
        );
        var cached = require.cache[resolved];
        var res = cached ? cached.exports : mod();
        return res;
    };

    require.paths = [];
    require.modules = {};
    require.cache = {};
    require.extensions = [".js", ".coffee", ".json"];

    require._core = {
        'assert': true,
        'events': true,
        'fs': true,
        'path': true,
        'vm': true
    };

    require.resolve = (function() {
        return function(x, cwd) {
            if (!cwd) cwd = '/';

            if (require._core[x]) return x;
            var path = require.modules.path();
            cwd = path.resolve('/', cwd);
            var y = cwd || '/';

            if (x.match(/^(?:\.\.?\/|\/)/)) {
                var m = loadAsFileSync(path.resolve(y, x)) || loadAsDirectorySync(path.resolve(y, x));
                if (m) return m;
            }

            var n = loadNodeModulesSync(x, y);
            if (n) return n;

            throw new Error("Cannot find module '" + x + "'");

            function loadAsFileSync(x) {
                x = path.normalize(x);
                if (require.modules[x]) {
                    return x;
                }

                for (var i = 0; i < require.extensions.length; i++) {
                    var ext = require.extensions[i];
                    if (require.modules[x + ext]) return x + ext;
                }
            }

            function loadAsDirectorySync(x) {
                x = x.replace(/\/+$/, '');
                var pkgfile = path.normalize(x + '/package.json');
                if (require.modules[pkgfile]) {
                    var pkg = require.modules[pkgfile]();
                    var b = pkg.browserify;
                    if (typeof b === 'object' && b.main) {
                        var m = loadAsFileSync(path.resolve(x, b.main));
                        if (m) return m;
                    } else if (typeof b === 'string') {
                        var m = loadAsFileSync(path.resolve(x, b));
                        if (m) return m;
                    } else if (pkg.main) {
                        var m = loadAsFileSync(path.resolve(x, pkg.main));
                        if (m) return m;
                    }
                }

                return loadAsFileSync(x + '/index');
            }

            function loadNodeModulesSync(x, start) {
                var dirs = nodeModulesPathsSync(start);
                for (var i = 0; i < dirs.length; i++) {
                    var dir = dirs[i];
                    var m = loadAsFileSync(dir + '/' + x);
                    if (m) return m;
                    var n = loadAsDirectorySync(dir + '/' + x);
                    if (n) return n;
                }

                var m = loadAsFileSync(x);
                if (m) return m;
            }

            function nodeModulesPathsSync(start) {
                var parts;
                if (start === '/') parts = [''];
                else parts = path.normalize(start).split('/');

                var dirs = [];
                for (var i = parts.length - 1; i >= 0; i--) {
                    if (parts[i] === 'node_modules') continue;
                    var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                    dirs.push(dir);
                }

                return dirs;
            }
        };
    })();

    require.alias = function(from, to) {
        var path = require.modules.path();
        var res = null;
        try {
            res = require.resolve(from + '/package.json', '/');
        } catch (err) {
            res = require.resolve(from, '/');
        }
        var basedir = path.dirname(res);

        var keys = (Object.keys || function(obj) {
            var res = [];
            for (var key in obj) res.push(key);
            return res;
        })(require.modules);

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key.slice(0, basedir.length + 1) === basedir + '/') {
                var f = key.slice(basedir.length);
                require.modules[to + f] = require.modules[basedir + f];
            } else if (key === basedir) {
                require.modules[to] = require.modules[basedir];
            }
        }
    };

    (function() {
        var process = {};
        var global = typeof window !== 'undefined' ? window : {};
        var definedProcess = false;

        require.define = function(filename, fn) {
            if (!definedProcess && require.modules.__browserify_process) {
                process = require.modules.__browserify_process();
                definedProcess = true;
            }

            var dirname = require._core[filename] ? '' : require.modules.path().dirname(filename);

            var require_ = function(file) {
                var requiredModule = require(file, dirname);
                var cached = require.cache[require.resolve(file, dirname)];

                if (cached && cached.parent === null) {
                    cached.parent = module_;
                }

                return requiredModule;
            };
            require_.resolve = function(name) {
                return require.resolve(name, dirname);
            };
            require_.modules = require.modules;
            require_.define = require.define;
            require_.cache = require.cache;
            var module_ = {
                id: filename,
                filename: filename,
                exports: {},
                loaded: false,
                parent: null
            };

            require.modules[filename] = function() {
                require.cache[filename] = module_;
                fn.call(
                    module_.exports,
                    require_,
                    module_,
                    module_.exports,
                    dirname,
                    filename,
                    process,
                    global
                );
                module_.loaded = true;
                return module_.exports;
            };
        };
    })();


    require.define("path", function(require, module, exports, __dirname, __filename, process, global) {
        function filter(xs, fn) {
            var res = [];
            for (var i = 0; i < xs.length; i++) {
                if (fn(xs[i], i, xs)) res.push(xs[i]);
            }
            return res;
        }

        // resolves . and .. elements in a path array with directory names there
        // must be no slashes, empty elements, or device names (c:\) in the array
        // (so also no leading and trailing slashes - it does not distinguish
        // relative and absolute paths)

        function normalizeArray(parts, allowAboveRoot) {
            // if the path tries to go above the root, `up` ends up > 0
            var up = 0;
            for (var i = parts.length; i >= 0; i--) {
                var last = parts[i];
                if (last == '.') {
                    parts.splice(i, 1);
                } else if (last === '..') {
                    parts.splice(i, 1);
                    up++;
                } else if (up) {
                    parts.splice(i, 1);
                    up--;
                }
            }

            // if the path is allowed to go above the root, restore leading ..s
            if (allowAboveRoot) {
                for (; up--; up) {
                    parts.unshift('..');
                }
            }

            return parts;
        }

        // Regex to split a filename into [*, dir, basename, ext]
        // posix version
        var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

        // path.resolve([from ...], to)
        // posix version
        exports.resolve = function() {
            var resolvedPath = '',
                resolvedAbsolute = false;

            for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
                var path = (i >= 0) ? arguments[i] : process.cwd();

                // Skip empty and invalid entries
                if (typeof path !== 'string' || !path) {
                    continue;
                }

                resolvedPath = path + '/' + resolvedPath;
                resolvedAbsolute = path.charAt(0) === '/';
            }

            // At this point the path should be resolved to a full absolute path, but
            // handle relative paths to be safe (might happen when process.cwd() fails)

            // Normalize the path
            resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
                return !!p;
            }), !resolvedAbsolute).join('/');

            return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
        };

        // path.normalize(path)
        // posix version
        exports.normalize = function(path) {
            var isAbsolute = path.charAt(0) === '/',
                trailingSlash = path.slice(-1) === '/';

            // Normalize the path
            path = normalizeArray(filter(path.split('/'), function(p) {
                return !!p;
            }), !isAbsolute).join('/');

            if (!path && !isAbsolute) {
                path = '.';
            }
            if (path && trailingSlash) {
                path += '/';
            }

            return (isAbsolute ? '/' : '') + path;
        };


        // posix version
        exports.join = function() {
            var paths = Array.prototype.slice.call(arguments, 0);
            return exports.normalize(filter(paths, function(p, index) {
                return p && typeof p === 'string';
            }).join('/'));
        };


        exports.dirname = function(path) {
            var dir = splitPathRe.exec(path)[1] || '';
            var isWindows = false;
            if (!dir) {
                // No dirname
                return '.';
            } else if (dir.length === 1 ||
                (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
                // It is just a slash or a drive letter with a slash
                return dir;
            } else {
                // It is a full dirname, strip trailing slash
                return dir.substring(0, dir.length - 1);
            }
        };


        exports.basename = function(path, ext) {
            var f = splitPathRe.exec(path)[2] || '';
            // TODO: make this comparison case-insensitive on windows?
            if (ext && f.substr(-1 * ext.length) === ext) {
                f = f.substr(0, f.length - ext.length);
            }
            return f;
        };


        exports.extname = function(path) {
            return splitPathRe.exec(path)[3] || '';
        };

        exports.relative = function(from, to) {
            from = exports.resolve(from).substr(1);
            to = exports.resolve(to).substr(1);

            function trim(arr) {
                var start = 0;
                for (; start < arr.length; start++) {
                    if (arr[start] !== '') break;
                }

                var end = arr.length - 1;
                for (; end >= 0; end--) {
                    if (arr[end] !== '') break;
                }

                if (start > end) return [];
                return arr.slice(start, end - start + 1);
            }

            var fromParts = trim(from.split('/'));
            var toParts = trim(to.split('/'));

            var length = Math.min(fromParts.length, toParts.length);
            var samePartsLength = length;
            for (var i = 0; i < length; i++) {
                if (fromParts[i] !== toParts[i]) {
                    samePartsLength = i;
                    break;
                }
            }

            var outputParts = [];
            for (var i = samePartsLength; i < fromParts.length; i++) {
                outputParts.push('..');
            }

            outputParts = outputParts.concat(toParts.slice(samePartsLength));

            return outputParts.join('/');
        };

    });

    require.define("__browserify_process", function(require, module, exports, __dirname, __filename, process, global) {
        var process = module.exports = {};

        process.nextTick = (function() {
            var canSetImmediate = typeof window !== 'undefined' && window.setImmediate;
            var canPost = typeof window !== 'undefined' && window.postMessage && window.addEventListener;

            if (canSetImmediate) {
                return function(f) {
                    return window.setImmediate(f)
                };
            }

            if (canPost) {
                var queue = [];
                window.addEventListener('message', function(ev) {
                    if (ev.source === window && ev.data === 'browserify-tick') {
                        ev.stopPropagation();
                        if (queue.length > 0) {
                            var fn = queue.shift();
                            fn();
                        }
                    }
                }, true);

                return function nextTick(fn) {
                    queue.push(fn);
                    window.postMessage('browserify-tick', '*');
                };
            }

            return function nextTick(fn) {
                setTimeout(fn, 0);
            };
        })();

        process.title = 'browser';
        process.browser = true;
        process.env = {};
        process.argv = [];

        process.binding = function(name) {
            if (name === 'evals') return (require)('vm')
            else throw new Error('No such module. (Possibly not yet loaded)')
        };

        (function() {
            var cwd = '/';
            var path;
            process.cwd = function() {
                return cwd
            };
            process.chdir = function(dir) {
                if (!path) path = require('path');
                cwd = path.resolve(dir, cwd);
            };
        })();

    });

    require.define("/package.json", function(require, module, exports, __dirname, __filename, process, global) {
        module.exports = {
            "main": "escodegen.js"
        }
    });

    require.define("/escodegen.js", function(require, module, exports, __dirname, __filename, process, global) {
        /*
  Copyright (C) 2012 Michael Ficarra <escodegen.copyright@michael.ficarra.me>
  Copyright (C) 2012 Robert Gust-Bardon <donate@robert.gust-bardon.org>
  Copyright (C) 2012 John Freeman <jfreeman08@gmail.com>
  Copyright (C) 2011-2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

        /*jslint bitwise:true */
        /*global escodegen:true, exports:true, generateStatement:true, generateExpression:true, generateFunctionBody:true, process:true, require:true, define:true*/
        (function() {
            'use strict';

            var Syntax,
                Precedence,
                BinaryPrecedence,
                Regex,
                VisitorKeys,
                VisitorOption,
                SourceNode,
                isArray,
                base,
                indent,
                json,
                renumber,
                hexadecimal,
                quotes,
                escapeless,
                newline,
                space,
                parentheses,
                semicolons,
                safeConcatenation,
                directive,
                extra,
                parse,
                sourceMap,
                traverse;

            traverse = require('estraverse').traverse;

            Syntax = {
                AssignmentExpression: 'AssignmentExpression',
                ArrayExpression: 'ArrayExpression',
                ArrayPattern: 'ArrayPattern',
                BlockStatement: 'BlockStatement',
                BinaryExpression: 'BinaryExpression',
                BreakStatement: 'BreakStatement',
                CallExpression: 'CallExpression',
                CatchClause: 'CatchClause',
                ComprehensionBlock: 'ComprehensionBlock',
                ComprehensionExpression: 'ComprehensionExpression',
                ConditionalExpression: 'ConditionalExpression',
                ContinueStatement: 'ContinueStatement',
                DirectiveStatement: 'DirectiveStatement',
                DoWhileStatement: 'DoWhileStatement',
                DebuggerStatement: 'DebuggerStatement',
                EmptyStatement: 'EmptyStatement',
                ExpressionStatement: 'ExpressionStatement',
                ForStatement: 'ForStatement',
                ForInStatement: 'ForInStatement',
                FunctionDeclaration: 'FunctionDeclaration',
                FunctionExpression: 'FunctionExpression',
                Identifier: 'Identifier',
                IfStatement: 'IfStatement',
                Literal: 'Literal',
                LabeledStatement: 'LabeledStatement',
                LogicalExpression: 'LogicalExpression',
                MemberExpression: 'MemberExpression',
                NewExpression: 'NewExpression',
                ObjectExpression: 'ObjectExpression',
                ObjectPattern: 'ObjectPattern',
                Program: 'Program',
                Property: 'Property',
                ReturnStatement: 'ReturnStatement',
                SequenceExpression: 'SequenceExpression',
                SwitchStatement: 'SwitchStatement',
                SwitchCase: 'SwitchCase',
                ThisExpression: 'ThisExpression',
                ThrowStatement: 'ThrowStatement',
                TryStatement: 'TryStatement',
                UnaryExpression: 'UnaryExpression',
                UpdateExpression: 'UpdateExpression',
                VariableDeclaration: 'VariableDeclaration',
                VariableDeclarator: 'VariableDeclarator',
                WhileStatement: 'WhileStatement',
                WithStatement: 'WithStatement',
                YieldExpression: 'YieldExpression',

            };

            Precedence = {
                Sequence: 0,
                Assignment: 1,
                Conditional: 2,
                LogicalOR: 3,
                LogicalAND: 4,
                BitwiseOR: 5,
                BitwiseXOR: 6,
                BitwiseAND: 7,
                Equality: 8,
                Relational: 9,
                BitwiseSHIFT: 10,
                Additive: 11,
                Multiplicative: 12,
                Unary: 13,
                Postfix: 14,
                Call: 15,
                New: 16,
                Member: 17,
                Primary: 18
            };

            BinaryPrecedence = {
                '||': Precedence.LogicalOR,
                '&&': Precedence.LogicalAND,
                '|': Precedence.BitwiseOR,
                '^': Precedence.BitwiseXOR,
                '&': Precedence.BitwiseAND,
                '==': Precedence.Equality,
                '!=': Precedence.Equality,
                '===': Precedence.Equality,
                '!==': Precedence.Equality,
                'is': Precedence.Equality,
                'isnt': Precedence.Equality,
                '<': Precedence.Relational,
                '>': Precedence.Relational,
                '<=': Precedence.Relational,
                '>=': Precedence.Relational,
                'in': Precedence.Relational,
                'instanceof': Precedence.Relational,
                '<<': Precedence.BitwiseSHIFT,
                '>>': Precedence.BitwiseSHIFT,
                '>>>': Precedence.BitwiseSHIFT,
                '+': Precedence.Additive,
                '-': Precedence.Additive,
                '*': Precedence.Multiplicative,
                '%': Precedence.Multiplicative,
                '/': Precedence.Multiplicative
            };

            Regex = {
                NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
            };

            function getDefaultOptions() {
                // default options
                return {
                    indent: null,
                    base: null,
                    parse: null,
                    comment: false,
                    format: {
                        indent: {
                            style: '    ',
                            base: 0,
                            adjustMultilineComment: false
                        },
                        json: false,
                        renumber: false,
                        hexadecimal: false,
                        quotes: 'single',
                        escapeless: false,
                        compact: false,
                        parentheses: true,
                        semicolons: true,
                        safeConcatenation: false
                    },
                    moz: {
                        starlessGenerator: false,
                        parenthesizedComprehensionBlock: false
                    },
                    sourceMap: null,
                    sourceMapRoot: null,
                    sourceMapWithCode: false,
                    directive: false,
                    verbatim: null
                };
            }

            function stringToArray(str) {
                var length = str.length,
                    result = [],
                    i;
                for (i = 0; i < length; i += 1) {
                    result[i] = str.charAt(i);
                }
                return result;
            }

            function stringRepeat(str, num) {
                var result = '';

                for (num |= 0; num > 0; num >>>= 1, str += str) {
                    if (num & 1) {
                        result += str;
                    }
                }

                return result;
            }

            isArray = Array.isArray;
            if (!isArray) {
                isArray = function isArray(array) {
                    return Object.prototype.toString.call(array) === '[object Array]';
                };
            }

            // Fallback for the non SourceMap environment

            function SourceNodeMock(line, column, filename, chunk) {
                var result = [];

                function flatten(input) {
                    var i, iz;
                    if (isArray(input)) {
                        for (i = 0, iz = input.length; i < iz; ++i) {
                            flatten(input[i]);
                        }
                    } else if (input instanceof SourceNodeMock) {
                        result.push(input);
                    } else if (typeof input === 'string' && input) {
                        result.push(input);
                    }
                }

                flatten(chunk);
                this.children = result;
            }

            SourceNodeMock.prototype.toString = function toString() {
                var res = '',
                    i, iz, node;
                for (i = 0, iz = this.children.length; i < iz; ++i) {
                    node = this.children[i];
                    if (node instanceof SourceNodeMock) {
                        res += node.toString();
                    } else {
                        res += node;
                    }
                }
                return res;
            };

            SourceNodeMock.prototype.replaceRight = function replaceRight(pattern, replacement) {
                var last = this.children[this.children.length - 1];
                if (last instanceof SourceNodeMock) {
                    last.replaceRight(pattern, replacement);
                } else if (typeof last === 'string') {
                    this.children[this.children.length - 1] = last.replace(pattern, replacement);
                } else {
                    this.children.push(''.replace(pattern, replacement));
                }
                return this;
            };

            SourceNodeMock.prototype.join = function join(sep) {
                var i, iz, result;
                result = [];
                iz = this.children.length;
                if (iz > 0) {
                    for (i = 0, iz -= 1; i < iz; ++i) {
                        result.push(this.children[i], sep);
                    }
                    result.push(this.children[iz]);
                    this.children = result;
                }
                return this;
            };

            function hasLineTerminator(str) {
                return /[\r\n]/g.test(str);
            }

            function endsWithLineTerminator(str) {
                var ch = str.charAt(str.length - 1);
                return ch === '\r' || ch === '\n';
            }

            function shallowCopy(obj) {
                var ret = {}, key;
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        ret[key] = obj[key];
                    }
                }
                return ret;
            }

            function deepCopy(obj) {
                var ret = {}, key, val;
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        val = obj[key];
                        if (typeof val === 'object' && val !== null) {
                            ret[key] = deepCopy(val);
                        } else {
                            ret[key] = val;
                        }
                    }
                }
                return ret;
            }

            function updateDeeply(target, override) {
                var key, val;

                function isHashObject(target) {
                    return typeof target === 'object' && target instanceof Object && !(target instanceof RegExp);
                }

                for (key in override) {
                    if (override.hasOwnProperty(key)) {
                        val = override[key];
                        if (isHashObject(val)) {
                            if (isHashObject(target[key])) {
                                updateDeeply(target[key], val);
                            } else {
                                target[key] = updateDeeply({}, val);
                            }
                        } else {
                            target[key] = val;
                        }
                    }
                }
                return target;
            }

            function generateNumber(value) {
                var result, point, temp, exponent, pos;

                if (value !== value) {
                    throw new Error('Numeric literal whose value is NaN');
                }
                if (value < 0 || (value === 0 && 1 / value < 0)) {
                    throw new Error('Numeric literal whose value is negative');
                }

                if (value === 1 / 0) {
                    return json ? 'null' : renumber ? '1e400' : '1e+400';
                }

                result = '' + value;
                if (!renumber || result.length < 3) {
                    return result;
                }

                point = result.indexOf('.');
                if (!json && result.charAt(0) === '0' && point === 1) {
                    point = 0;
                    result = result.slice(1);
                }
                temp = result;
                result = result.replace('e+', 'e');
                exponent = 0;
                if ((pos = temp.indexOf('e')) > 0) {
                    exponent = +temp.slice(pos + 1);
                    temp = temp.slice(0, pos);
                }
                if (point >= 0) {
                    exponent -= temp.length - point - 1;
                    temp = +(temp.slice(0, point) + temp.slice(point + 1)) + '';
                }
                pos = 0;
                while (temp.charAt(temp.length + pos - 1) === '0') {
                    pos -= 1;
                }
                if (pos !== 0) {
                    exponent -= pos;
                    temp = temp.slice(0, pos);
                }
                if (exponent !== 0) {
                    temp += 'e' + exponent;
                }
                if ((temp.length < result.length ||
                    (hexadecimal && value > 1e12 && Math.floor(value) === value && (temp = '0x' + value.toString(16)).length < result.length)) && +temp === value) {
                    result = temp;
                }

                return result;
            }

            function escapeAllowedCharacter(ch, next) {
                var code = ch.charCodeAt(0),
                    hex = code.toString(16),
                    result = '\\';

                switch (ch) {
                    case '\b':
                        result += 'b';
                        break;
                    case '\f':
                        result += 'f';
                        break;
                    case '\t':
                        result += 't';
                        break;
                    default:
                        if (json || code > 0xff) {
                            result += 'u' + '0000'.slice(hex.length) + hex;
                        } else if (ch === '\u0000' && '0123456789'.indexOf(next) < 0) {
                            result += '0';
                        } else if (ch === '\v') {
                            result += 'v';
                        } else {
                            result += 'x' + '00'.slice(hex.length) + hex;
                        }
                        break;
                }

                return result;
            }

            function escapeDisallowedCharacter(ch) {
                var result = '\\';
                switch (ch) {
                    case '\\':
                        result += '\\';
                        break;
                    case '\n':
                        result += 'n';
                        break;
                    case '\r':
                        result += 'r';
                        break;
                    case '\u2028':
                        result += 'u2028';
                        break;
                    case '\u2029':
                        result += 'u2029';
                        break;
                    default:
                        throw new Error('Incorrectly classified character');
                }

                return result;
            }

            function escapeDirective(str) {
                var i, iz, ch, single, buf, quote;

                buf = str;
                if (typeof buf[0] === 'undefined') {
                    buf = stringToArray(buf);
                }

                quote = quotes === 'double' ? '"' : '\'';
                for (i = 0, iz = buf.length; i < iz; i += 1) {
                    ch = buf[i];
                    if (ch === '\'') {
                        quote = '"';
                        break;
                    } else if (ch === '"') {
                        quote = '\'';
                        break;
                    } else if (ch === '\\') {
                        i += 1;
                    }
                }

                return quote + str + quote;
            }

            function escapeString(str) {
                var result = '',
                    i, len, ch, next, singleQuotes = 0,
                    doubleQuotes = 0,
                    single;

                if (typeof str[0] === 'undefined') {
                    str = stringToArray(str);
                }

                for (i = 0, len = str.length; i < len; i += 1) {
                    ch = str[i];
                    if (ch === '\'') {
                        singleQuotes += 1;
                    } else if (ch === '"') {
                        doubleQuotes += 1;
                    } else if (ch === '/' && json) {
                        result += '\\';
                    } else if ('\\\n\r\u2028\u2029'.indexOf(ch) >= 0) {
                        result += escapeDisallowedCharacter(ch);
                        continue;
                    } else if ((json && ch < ' ') || !(json || escapeless || (ch >= ' ' && ch <= '~'))) {
                        result += escapeAllowedCharacter(ch, str[i + 1]);
                        continue;
                    }
                    result += ch;
                }

                single = !(quotes === 'double' || (quotes === 'auto' && doubleQuotes < singleQuotes));
                str = result;
                result = single ? '\'' : '"';

                if (typeof str[0] === 'undefined') {
                    str = stringToArray(str);
                }

                for (i = 0, len = str.length; i < len; i += 1) {
                    ch = str[i];
                    if ((ch === '\'' && single) || (ch === '"' && !single)) {
                        result += '\\';
                    }
                    result += ch;
                }

                return result + (single ? '\'' : '"');
            }

            function isWhiteSpace(ch) {
                return '\t\v\f \xa0'.indexOf(ch) >= 0 || (ch.charCodeAt(0) >= 0x1680 && '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\ufeff'.indexOf(ch) >= 0);
            }

            function isLineTerminator(ch) {
                return '\n\r\u2028\u2029'.indexOf(ch) >= 0;
            }

            function isIdentifierPart(ch) {
                return (ch === '$') || (ch === '_') || (ch === '\\') ||
                    (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                    ((ch >= '0') && (ch <= '9')) ||
                    ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierPart.test(ch));
            }

            function toSourceNode(generated, node) {
                if (node == null) {
                    if (generated instanceof SourceNode) {
                        return generated;
                    } else {
                        node = {};
                    }
                }
                if (node.loc == null) {
                    return new SourceNode(null, null, sourceMap, generated);
                }
                return new SourceNode(node.loc.start.line, node.loc.start.column, (sourceMap === true ? node.loc.source || null : sourceMap), generated);
            }

            function join(left, right) {
                var leftSource = toSourceNode(left).toString(),
                    rightSource = toSourceNode(right).toString(),
                    leftChar = leftSource.charAt(leftSource.length - 1),
                    rightChar = rightSource.charAt(0);

                if (((leftChar === '+' || leftChar === '-') && leftChar === rightChar) || (isIdentifierPart(leftChar) && isIdentifierPart(rightChar))) {
                    return [left, ' ', right];
                } else if (isWhiteSpace(leftChar) || isLineTerminator(leftChar) || isWhiteSpace(rightChar) || isLineTerminator(rightChar)) {
                    return [left, right];
                }
                return [left, space, right];
            }

            function addIndent(stmt) {
                return [base, stmt];
            }

            function withIndent(fn) {
                var previousBase, result;
                previousBase = base;
                base += indent;
                result = fn.call(this, base);
                base = previousBase;
                return result;
            }

            function calculateSpaces(str) {
                var i;
                for (i = str.length - 1; i >= 0; i -= 1) {
                    if (isLineTerminator(str.charAt(i))) {
                        break;
                    }
                }
                return (str.length - 1) - i;
            }

            function adjustMultilineComment(value, specialBase) {
                var array, i, len, line, j, ch, spaces, previousBase;

                array = value.split(/\r\n|[\r\n]/);
                spaces = Number.MAX_VALUE;

                // first line doesn't have indentation
                for (i = 1, len = array.length; i < len; i += 1) {
                    line = array[i];
                    j = 0;
                    while (j < line.length && isWhiteSpace(line[j])) {
                        j += 1;
                    }
                    if (spaces > j) {
                        spaces = j;
                    }
                }

                if (typeof specialBase !== 'undefined') {
                    // pattern like
                    // {
                    //   var t = 20;  /*
                    //                 * this is comment
                    //                 */
                    // }
                    previousBase = base;
                    if (array[1][spaces] === '*') {
                        specialBase += ' ';
                    }
                    base = specialBase;
                } else {
                    if (spaces & 1) {
                        // /*
                        //  *
                        //  */
                        // If spaces are odd number, above pattern is considered.
                        // We waste 1 space.
                        spaces -= 1;
                    }
                    previousBase = base;
                }

                for (i = 1, len = array.length; i < len; i += 1) {
                    array[i] = toSourceNode(addIndent(array[i].slice(spaces))).join('');
                }

                base = previousBase;

                return array.join('\n');
            }

            function generateComment(comment, specialBase) {
                if (comment.type === 'Line') {
                    if (endsWithLineTerminator(comment.value)) {
                        return '//' + comment.value;
                    } else {
                        // Always use LineTerminator
                        return '//' + comment.value + '\n';
                    }
                }
                if (extra.format.indent.adjustMultilineComment && /[\n\r]/.test(comment.value)) {
                    return adjustMultilineComment('/*' + comment.value + '*/', specialBase);
                }
                return '/*' + comment.value + '*/';
            }

            function addCommentsToStatement(stmt, result) {
                var i, len, comment, save, node, tailingToStatement, specialBase, fragment;

                if (stmt.leadingComments && stmt.leadingComments.length > 0) {
                    save = result;

                    comment = stmt.leadingComments[0];
                    result = [];
                    if (safeConcatenation && stmt.type === Syntax.Program && stmt.body.length === 0) {
                        result.push('\n');
                    }
                    result.push(generateComment(comment));
                    if (!endsWithLineTerminator(toSourceNode(result).toString())) {
                        result.push('\n');
                    }

                    for (i = 1, len = stmt.leadingComments.length; i < len; i += 1) {
                        comment = stmt.leadingComments[i];
                        fragment = [generateComment(comment)];
                        if (!endsWithLineTerminator(toSourceNode(fragment).toString())) {
                            fragment.push('\n');
                        }
                        result.push(addIndent(fragment));
                    }

                    result.push(addIndent(save));
                }

                if (stmt.trailingComments) {
                    tailingToStatement = !endsWithLineTerminator(toSourceNode(result).toString());
                    specialBase = stringRepeat(' ', calculateSpaces(toSourceNode([base, result, indent]).toString()));
                    for (i = 0, len = stmt.trailingComments.length; i < len; i += 1) {
                        comment = stmt.trailingComments[i];
                        if (tailingToStatement) {
                            // We assume target like following script
                            //
                            // var t = 20;  /**
                            //               * This is comment of t
                            //               */
                            if (i === 0) {
                                // first case
                                result = [result, indent];
                            } else {
                                result = [result, specialBase];
                            }
                            result.push(generateComment(comment, specialBase));
                        } else {
                            result = [result, addIndent(generateComment(comment))];
                        }
                        if (i !== len - 1 && !endsWithLineTerminator(toSourceNode(result).toString())) {
                            result = [result, '\n'];
                        }
                    }
                }

                return result;
            }

            function parenthesize(text, current, should) {
                if (current < should) {
                    return ['(', text, ')'];
                }
                return text;
            }

            function maybeBlock(stmt, semicolonOptional, functionBody) {
                var result, noLeadingComment;

                noLeadingComment = !extra.comment || !stmt.leadingComments;

                if (stmt.type === Syntax.BlockStatement && noLeadingComment) {
                    return [space, generateStatement(stmt, {
                        functionBody: functionBody
                    })];
                }

                if (stmt.type === Syntax.EmptyStatement && noLeadingComment) {
                    return ';';
                }

                withIndent(function() {
                    result = [newline, addIndent(generateStatement(stmt, {
                        semicolonOptional: semicolonOptional,
                        functionBody: functionBody
                    }))];
                });

                return result;
            }

            function maybeBlockSuffix(stmt, result) {
                var ends = endsWithLineTerminator(toSourceNode(result).toString());
                if (stmt.type === Syntax.BlockStatement && (!extra.comment || !stmt.leadingComments) && !ends) {
                    return [result, space];
                }
                if (ends) {
                    return [result, base];
                }
                return [result, newline, base];
            }

            function generateVerbatim(expr, option) {
                var i, result;
                result = expr[extra.verbatim].split(/\r\n|\n/);
                for (i = 1; i < result.length; i++) {
                    result[i] = newline + base + result[i];
                }

                result = parenthesize(result, Precedence.Sequence, option.precedence);
                return toSourceNode(result, expr);
            }

            function generateFunctionBody(node) {
                var result, i, len, expr;
                result = ['('];
                for (i = 0, len = node.params.length; i < len; i += 1) {
                    result.push(node.params[i].name);
                    if (i + 1 < len) {
                        result.push(',' + space);
                    }
                }
                result.push(')');

                if (node.expression) {
                    result.push(space);
                    expr = generateExpression(node.body, {
                        precedence: Precedence.Assignment,
                        allowIn: true,
                        allowCall: true
                    });
                    if (expr.toString().charAt(0) === '{') {
                        expr = ['(', expr, ')'];
                    }
                    result.push(expr);
                } else {
                    result.push(maybeBlock(node.body, false, true));
                }
                return result;
            }

            function generateExpression(expr, option) {
                var result, precedence, type, currentPrecedence, i, len, raw, fragment, multiline, leftChar, leftSource, rightChar, rightSource, allowIn, allowCall, allowUnparenthesizedNew, property, key, value;

                precedence = option.precedence;
                allowIn = option.allowIn;
                allowCall = option.allowCall;
                type = expr.type || option.type;

                if (extra.verbatim && expr.hasOwnProperty(extra.verbatim)) {
                    return generateVerbatim(expr, option);
                }

                switch (type) {
                    case Syntax.SequenceExpression:
                        result = [];
                        allowIn |= (Precedence.Sequence < precedence);
                        for (i = 0, len = expr.expressions.length; i < len; i += 1) {
                            result.push(generateExpression(expr.expressions[i], {
                                precedence: Precedence.Assignment,
                                allowIn: allowIn,
                                allowCall: true
                            }));
                            if (i + 1 < len) {
                                result.push(',' + space);
                            }
                        }
                        result = parenthesize(result, Precedence.Sequence, precedence);
                        break;

                    case Syntax.AssignmentExpression:
                        allowIn |= (Precedence.Assignment < precedence);
                        result = parenthesize(
                            [
                                generateExpression(expr.left, {
                                    precedence: Precedence.Call,
                                    allowIn: allowIn,
                                    allowCall: true
                                }),
                                space + expr.operator + space,
                                generateExpression(expr.right, {
                                    precedence: Precedence.Assignment,
                                    allowIn: allowIn,
                                    allowCall: true
                                })
                            ],
                            Precedence.Assignment,
                            precedence
                        );
                        break;

                    case Syntax.ConditionalExpression:
                        allowIn |= (Precedence.Conditional < precedence);
                        result = parenthesize(
                            [
                                generateExpression(expr.test, {
                                    precedence: Precedence.LogicalOR,
                                    allowIn: allowIn,
                                    allowCall: true
                                }),
                                space + '?' + space,
                                generateExpression(expr.consequent, {
                                    precedence: Precedence.Assignment,
                                    allowIn: allowIn,
                                    allowCall: true
                                }),
                                space + ':' + space,
                                generateExpression(expr.alternate, {
                                    precedence: Precedence.Assignment,
                                    allowIn: allowIn,
                                    allowCall: true
                                })
                            ],
                            Precedence.Conditional,
                            precedence
                        );
                        break;

                    case Syntax.LogicalExpression:
                    case Syntax.BinaryExpression:
                        currentPrecedence = BinaryPrecedence[expr.operator];

                        allowIn |= (currentPrecedence < precedence);

                        result = join(
                            generateExpression(expr.left, {
                                precedence: currentPrecedence,
                                allowIn: allowIn,
                                allowCall: true
                            }),
                            expr.operator
                        );

                        fragment = generateExpression(expr.right, {
                            precedence: currentPrecedence + 1,
                            allowIn: allowIn,
                            allowCall: true
                        });

                        if (expr.operator === '/' && fragment.toString().charAt(0) === '/') {
                            // If '/' concats with '/', it is interpreted as comment start
                            result.push(' ', fragment);
                        } else {
                            result = join(result, fragment);
                        }

                        if (expr.operator === 'in' && !allowIn) {
                            result = ['(', result, ')'];
                        } else {
                            result = parenthesize(result, currentPrecedence, precedence);
                        }

                        break;

                    case Syntax.CallExpression:
                        result = [generateExpression(expr.callee, {
                            precedence: Precedence.Call,
                            allowIn: true,
                            allowCall: true,
                            allowUnparenthesizedNew: false
                        })];

                        result.push('(');
                        for (i = 0, len = expr['arguments'].length; i < len; i += 1) {
                            result.push(generateExpression(expr['arguments'][i], {
                                precedence: Precedence.Assignment,
                                allowIn: true,
                                allowCall: true
                            }));
                            if (i + 1 < len) {
                                result.push(',' + space);
                            }
                        }
                        result.push(')');

                        if (!allowCall) {
                            result = ['(', result, ')'];
                        } else {
                            result = parenthesize(result, Precedence.Call, precedence);
                        }
                        break;

                    case Syntax.NewExpression:
                        len = expr['arguments'].length;
                        allowUnparenthesizedNew = option.allowUnparenthesizedNew === undefined || option.allowUnparenthesizedNew;

                        result = join(
                            'new',
                            generateExpression(expr.callee, {
                                precedence: Precedence.New,
                                allowIn: true,
                                allowCall: false,
                                allowUnparenthesizedNew: allowUnparenthesizedNew && !parentheses && len === 0
                            })
                        );

                        if (!allowUnparenthesizedNew || parentheses || len > 0) {
                            result.push('(');
                            for (i = 0; i < len; i += 1) {
                                result.push(generateExpression(expr['arguments'][i], {
                                    precedence: Precedence.Assignment,
                                    allowIn: true,
                                    allowCall: true
                                }));
                                if (i + 1 < len) {
                                    result.push(',' + space);
                                }
                            }
                            result.push(')');
                        }

                        result = parenthesize(result, Precedence.New, precedence);
                        break;

                    case Syntax.MemberExpression:
                        result = [generateExpression(expr.object, {
                            precedence: Precedence.Call,
                            allowIn: true,
                            allowCall: allowCall,
                            allowUnparenthesizedNew: false
                        })];

                        if (expr.computed) {
                            result.push('[', generateExpression(expr.property, {
                                precedence: Precedence.Sequence,
                                allowIn: true,
                                allowCall: allowCall
                            }), ']');
                        } else {
                            if (expr.object.type === Syntax.Literal && typeof expr.object.value === 'number') {
                                if (result.indexOf('.') < 0) {
                                    if (!/[eExX]/.test(result) && !(result.length >= 2 && result[0] === '0')) {
                                        result.push('.');
                                    }
                                }
                            }
                            result.push('.' + expr.property.name);
                        }

                        result = parenthesize(result, Precedence.Member, precedence);
                        break;

                    case Syntax.UnaryExpression:
                        fragment = generateExpression(expr.argument, {
                            precedence: Precedence.Unary,
                            allowIn: true,
                            allowCall: true
                        });

                        if (space === '') {
                            result = join(expr.operator, fragment);
                        } else {
                            result = [expr.operator];
                            if (expr.operator.length > 2) {
                                // delete, void, typeof
                                // get `typeof []`, not `typeof[]`
                                result = join(result, fragment);
                            } else {
                                // Prevent inserting spaces between operator and argument if it is unnecessary
                                // like, `!cond`
                                leftSource = toSourceNode(result).toString();
                                leftChar = leftSource.charAt(leftSource.length - 1);
                                rightChar = fragment.toString().charAt(0);

                                if (((leftChar === '+' || leftChar === '-') && leftChar === rightChar) || (isIdentifierPart(leftChar) && isIdentifierPart(rightChar))) {
                                    result.push(' ', fragment);
                                } else {
                                    result.push(fragment);
                                }
                            }
                        }
                        result = parenthesize(result, Precedence.Unary, precedence);
                        break;

                    case Syntax.YieldExpression:
                        if (expr.delegate) {
                            result = 'yield*';
                        } else {
                            result = 'yield';
                        }
                        if (expr.argument) {
                            result = join(
                                result,
                                generateExpression(expr.argument, {
                                    precedence: Precedence.Assignment,
                                    allowIn: true,
                                    allowCall: true
                                })
                            );
                        }
                        break;

                    case Syntax.UpdateExpression:
                        if (expr.prefix) {
                            result = parenthesize(
                                [
                                    expr.operator,
                                    generateExpression(expr.argument, {
                                        precedence: Precedence.Unary,
                                        allowIn: true,
                                        allowCall: true
                                    })
                                ],
                                Precedence.Unary,
                                precedence
                            );
                        } else {
                            result = parenthesize(
                                [
                                    generateExpression(expr.argument, {
                                        precedence: Precedence.Postfix,
                                        allowIn: true,
                                        allowCall: true
                                    }),
                                    expr.operator
                                ],
                                Precedence.Postfix,
                                precedence
                            );
                        }
                        break;

                    case Syntax.FunctionExpression:
                        result = 'function';
                        if (expr.id) {
                            result += ' ' + expr.id.name;
                        } else {
                            result += space;
                        }

                        result = [result, generateFunctionBody(expr)];
                        break;

                    case Syntax.ArrayPattern:
                    case Syntax.ArrayExpression:
                        if (!expr.elements.length) {
                            result = '[]';
                            break;
                        }
                        multiline = expr.elements.length > 1;
                        result = ['[', multiline ? newline : ''];
                        withIndent(function(indent) {
                            for (i = 0, len = expr.elements.length; i < len; i += 1) {
                                if (!expr.elements[i]) {
                                    if (multiline) {
                                        result.push(indent);
                                    }
                                    if (i + 1 === len) {
                                        result.push(',');
                                    }
                                } else {
                                    result.push(multiline ? indent : '', generateExpression(expr.elements[i], {
                                        precedence: Precedence.Assignment,
                                        allowIn: true,
                                        allowCall: true
                                    }));
                                }
                                if (i + 1 < len) {
                                    result.push(',' + (multiline ? newline : space));
                                }
                            }
                        });
                        if (multiline && !endsWithLineTerminator(toSourceNode(result).toString())) {
                            result.push(newline);
                        }
                        result.push(multiline ? base : '', ']');
                        break;

                    case Syntax.Property:
                        if (expr.kind === 'get' || expr.kind === 'set') {
                            result = [
                                expr.kind + ' ',
                                generateExpression(expr.key, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                generateFunctionBody(expr.value)
                            ];
                        } else {
                            if (expr.shorthand) {
                                result = generateExpression(expr.key, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                });
                            } else if (expr.method) {
                                result = [];
                                if (expr.value.generator) {
                                    result.push('*');
                                }
                                result.push(generateExpression(expr.key, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }), generateFunctionBody(expr.value));
                            } else {
                                result = [
                                    generateExpression(expr.key, {
                                        precedence: Precedence.Sequence,
                                        allowIn: true,
                                        allowCall: true
                                    }),
                                    ':' + space,
                                    generateExpression(expr.value, {
                                        precedence: Precedence.Assignment,
                                        allowIn: true,
                                        allowCall: true
                                    })
                                ];
                            }
                        }
                        break;

                    case Syntax.ObjectExpression:
                        if (!expr.properties.length) {
                            result = '{}';
                            break;
                        }
                        multiline = expr.properties.length > 1;

                        withIndent(function(indent) {
                            fragment = generateExpression(expr.properties[0], {
                                precedence: Precedence.Sequence,
                                allowIn: true,
                                allowCall: true,
                                type: Syntax.Property
                            });
                        });

                        if (!multiline) {
                            // issues 4
                            // Do not transform from
                            //   dejavu.Class.declare({
                            //       method2: function () {}
                            //   });
                            // to
                            //   dejavu.Class.declare({method2: function () {
                            //       }});
                            if (!hasLineTerminator(toSourceNode(fragment).toString())) {
                                result = ['{', space, fragment, space, '}'];
                                break;
                            }
                        }

                        withIndent(function(indent) {
                            result = ['{', newline, indent, fragment];

                            if (multiline) {
                                result.push(',' + newline);
                                for (i = 1, len = expr.properties.length; i < len; i += 1) {
                                    result.push(indent, generateExpression(expr.properties[i], {
                                        precedence: Precedence.Sequence,
                                        allowIn: true,
                                        allowCall: true,
                                        type: Syntax.Property
                                    }));
                                    if (i + 1 < len) {
                                        result.push(',' + newline);
                                    }
                                }
                            }
                        });

                        if (!endsWithLineTerminator(toSourceNode(result).toString())) {
                            result.push(newline);
                        }
                        result.push(base, '}');
                        break;

                    case Syntax.ObjectPattern:
                        if (!expr.properties.length) {
                            result = '{}';
                            break;
                        }

                        multiline = false;
                        if (expr.properties.length === 1) {
                            property = expr.properties[0];
                            if (property.value.type !== Syntax.Identifier) {
                                multiline = true;
                            }
                        } else {
                            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                                property = expr.properties[i];
                                if (!property.shorthand) {
                                    multiline = true;
                                    break;
                                }
                            }
                        }
                        result = ['{', multiline ? newline : ''];

                        withIndent(function(indent) {
                            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                                result.push(multiline ? indent : '', generateExpression(expr.properties[i], {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }));
                                if (i + 1 < len) {
                                    result.push(',' + (multiline ? newline : space));
                                }
                            }
                        });

                        if (multiline && !endsWithLineTerminator(toSourceNode(result).toString())) {
                            result.push(newline);
                        }
                        result.push(multiline ? base : '', '}');
                        break;

                    case Syntax.ThisExpression:
                        result = 'this';
                        break;

                    case Syntax.Identifier:
                        result = expr.name;
                        break;

                    case Syntax.Literal:
                        if (expr.hasOwnProperty('raw') && parse) {
                            try {
                                raw = parse(expr.raw).body[0].expression;
                                if (raw.type === Syntax.Literal) {
                                    if (raw.value === expr.value) {
                                        result = expr.raw;
                                        break;
                                    }
                                }
                            } catch (e) {
                                // not use raw property
                            }
                        }

                        if (expr.value === null) {
                            result = 'null';
                            break;
                        }

                        if (typeof expr.value === 'string') {
                            result = escapeString(expr.value);
                            break;
                        }

                        if (typeof expr.value === 'number') {
                            result = generateNumber(expr.value);
                            break;
                        }

                        result = expr.value.toString();
                        break;

                    case Syntax.ComprehensionExpression:
                        result = [
                            '[',
                            generateExpression(expr.body, {
                                precedence: Precedence.Assignment,
                                allowIn: true,
                                allowCall: true
                            })
                        ];

                        if (expr.blocks) {
                            for (i = 0, len = expr.blocks.length; i < len; i += 1) {
                                fragment = generateExpression(expr.blocks[i], {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                });
                                result = join(result, fragment);
                            }
                        }

                        if (expr.filter) {
                            result = join(result, 'if' + space);
                            fragment = generateExpression(expr.filter, {
                                precedence: Precedence.Sequence,
                                allowIn: true,
                                allowCall: true
                            });
                            if (extra.moz.parenthesizedComprehensionBlock) {
                                result = join(result, ['(', fragment, ')']);
                            } else {
                                result = join(result, fragment);
                            }
                        }
                        result.push(']');
                        break;

                    case Syntax.ComprehensionBlock:
                        if (expr.left.type === Syntax.VariableDeclaration) {
                            fragment = [
                                expr.left.kind + ' ',
                                generateStatement(expr.left.declarations[0], {
                                    allowIn: false
                                })
                            ];
                        } else {
                            fragment = generateExpression(expr.left, {
                                precedence: Precedence.Call,
                                allowIn: true,
                                allowCall: true
                            });
                        }

                        fragment = join(fragment, expr.of ? 'of' : 'in');
                        fragment = join(fragment, generateExpression(expr.right, {
                            precedence: Precedence.Sequence,
                            allowIn: true,
                            allowCall: true
                        }));

                        if (extra.moz.parenthesizedComprehensionBlock) {
                            result = ['for' + space + '(', fragment, ')'];
                        } else {
                            result = join('for' + space, fragment);
                        }
                        break;

                    default:
                        throw new Error('Unknown expression type: ' + expr.type);
                }

                return toSourceNode(result, expr);
            }

            function generateStatement(stmt, option) {
                var i, len, result, node, allowIn, functionBody, directiveContext, fragment, semicolon;

                allowIn = true;
                semicolon = ';';
                functionBody = false;
                directiveContext = false;
                if (option) {
                    allowIn = option.allowIn === undefined || option.allowIn;
                    if (!semicolons && option.semicolonOptional === true) {
                        semicolon = '';
                    }
                    functionBody = option.functionBody;
                    directiveContext = option.directiveContext;
                }

                switch (stmt.type) {
                    case Syntax.BlockStatement:
                        result = ['{', newline];

                        withIndent(function() {
                            for (i = 0, len = stmt.body.length; i < len; i += 1) {
                                fragment = addIndent(generateStatement(stmt.body[i], {
                                    semicolonOptional: i === len - 1,
                                    directiveContext: functionBody
                                }));
                                result.push(fragment);
                                if (!endsWithLineTerminator(toSourceNode(fragment).toString())) {
                                    result.push(newline);
                                }
                            }
                        });

                        result.push(addIndent('}'));
                        break;

                    case Syntax.BreakStatement:
                        if (stmt.label) {
                            result = 'break ' + stmt.label.name + semicolon;
                        } else {
                            result = 'break' + semicolon;
                        }
                        break;

                    case Syntax.ContinueStatement:
                        if (stmt.label) {
                            result = 'continue ' + stmt.label.name + semicolon;
                        } else {
                            result = 'continue' + semicolon;
                        }
                        break;

                    case Syntax.DirectiveStatement:
                        if (stmt.raw) {
                            result = stmt.raw + semicolon;
                        } else {
                            result = escapeDirective(stmt.directive) + semicolon;
                        }
                        break;

                    case Syntax.DoWhileStatement:
                        // Because `do 42 while (cond)` is Syntax Error. We need semicolon.
                        result = join('do', maybeBlock(stmt.body));
                        result = maybeBlockSuffix(stmt.body, result);
                        result = join(result, [
                            'while' + space + '(',
                            generateExpression(stmt.test, {
                                precedence: Precedence.Sequence,
                                allowIn: true,
                                allowCall: true
                            }),
                            ')' + semicolon
                        ]);
                        break;

                    case Syntax.CatchClause:
                        withIndent(function() {
                            result = [
                                'catch' + space + '(',
                                generateExpression(stmt.param, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                ')'
                            ];
                        });
                        result.push(maybeBlock(stmt.body));
                        break;

                    case Syntax.DebuggerStatement:
                        result = 'debugger' + semicolon;
                        break;

                    case Syntax.EmptyStatement:
                        result = ';';
                        break;

                    case Syntax.ExpressionStatement:
                        result = [generateExpression(stmt.expression, {
                            precedence: Precedence.Sequence,
                            allowIn: true,
                            allowCall: true
                        })];
                        // 12.4 '{', 'function' is not allowed in this position.
                        // wrap expression with parentheses
                        if (result.toString().charAt(0) === '{' || (result.toString().slice(0, 8) === 'function' && " (".indexOf(result.toString().charAt(8)) >= 0) || (directive && directiveContext && stmt.expression.type === Syntax.Literal && typeof stmt.expression.value === 'string')) {
                            result = ['(', result, ')' + semicolon];
                        } else {
                            result.push(semicolon);
                        }
                        break;

                    case Syntax.VariableDeclarator:
                        if (stmt.init) {
                            result = [
                                generateExpression(stmt.id, {
                                    precedence: Precedence.Assignment,
                                    allowIn: allowIn,
                                    allowCall: true
                                }) + space + '=' + space,
                                generateExpression(stmt.init, {
                                    precedence: Precedence.Assignment,
                                    allowIn: allowIn,
                                    allowCall: true
                                })
                            ];
                        } else {
                            result = stmt.id.name;
                        }
                        break;

                    case Syntax.VariableDeclaration:
                        result = [stmt.kind];
                        // special path for
                        // var x = function () {
                        // };
                        if (stmt.declarations.length === 1 && stmt.declarations[0].init &&
                            stmt.declarations[0].init.type === Syntax.FunctionExpression) {
                            result.push(' ', generateStatement(stmt.declarations[0], {
                                allowIn: allowIn
                            }));
                        } else {
                            // VariableDeclarator is typed as Statement,
                            // but joined with comma (not LineTerminator).
                            // So if comment is attached to target node, we should specialize.
                            withIndent(function() {
                                node = stmt.declarations[0];
                                if (extra.comment && node.leadingComments) {
                                    result.push('\n', addIndent(generateStatement(node, {
                                        allowIn: allowIn
                                    })));
                                } else {
                                    result.push(' ', generateStatement(node, {
                                        allowIn: allowIn
                                    }));
                                }

                                for (i = 1, len = stmt.declarations.length; i < len; i += 1) {
                                    node = stmt.declarations[i];
                                    if (extra.comment && node.leadingComments) {
                                        result.push(',' + newline, addIndent(generateStatement(node, {
                                            allowIn: allowIn
                                        })));
                                    } else {
                                        result.push(',' + space, generateStatement(node, {
                                            allowIn: allowIn
                                        }));
                                    }
                                }
                            });
                        }
                        result.push(semicolon);
                        break;

                    case Syntax.ThrowStatement:
                        result = [join(
                            'throw',
                            generateExpression(stmt.argument, {
                                precedence: Precedence.Sequence,
                                allowIn: true,
                                allowCall: true
                            })
                        ), semicolon];
                        break;

                    case Syntax.TryStatement:
                        result = ['try', maybeBlock(stmt.block)];
                        result = maybeBlockSuffix(stmt.block, result);
                        for (i = 0, len = stmt.handlers.length; i < len; i += 1) {
                            result = join(result, generateStatement(stmt.handlers[i]));
                            if (stmt.finalizer || i + 1 !== len) {
                                result = maybeBlockSuffix(stmt.handlers[i].body, result);
                            }
                        }
                        if (stmt.finalizer) {
                            result = join(result, ['finally', maybeBlock(stmt.finalizer)]);
                        }
                        break;

                    case Syntax.SwitchStatement:
                        withIndent(function() {
                            result = [
                                'switch' + space + '(',
                                generateExpression(stmt.discriminant, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                ')' + space + '{' + newline
                            ];
                        });
                        if (stmt.cases) {
                            for (i = 0, len = stmt.cases.length; i < len; i += 1) {
                                fragment = addIndent(generateStatement(stmt.cases[i], {
                                    semicolonOptional: i === len - 1
                                }));
                                result.push(fragment);
                                if (!endsWithLineTerminator(toSourceNode(fragment).toString())) {
                                    result.push(newline);
                                }
                            }
                        }
                        result.push(addIndent('}'));
                        break;

                    case Syntax.SwitchCase:
                        withIndent(function() {
                            if (stmt.test) {
                                result = [
                                    join('case', generateExpression(stmt.test, {
                                        precedence: Precedence.Sequence,
                                        allowIn: true,
                                        allowCall: true
                                    })),
                                    ':'
                                ];
                            } else {
                                result = ['default:'];
                            }

                            i = 0;
                            len = stmt.consequent.length;
                            if (len && stmt.consequent[0].type === Syntax.BlockStatement) {
                                fragment = maybeBlock(stmt.consequent[0]);
                                result.push(fragment);
                                i = 1;
                            }

                            if (i !== len && !endsWithLineTerminator(toSourceNode(result).toString())) {
                                result.push(newline);
                            }

                            for (; i < len; i += 1) {
                                fragment = addIndent(generateStatement(stmt.consequent[i], {
                                    semicolonOptional: i === len - 1 && semicolon === ''
                                }));
                                result.push(fragment);
                                if (i + 1 !== len && !endsWithLineTerminator(toSourceNode(fragment).toString())) {
                                    result.push(newline);
                                }
                            }
                        });
                        break;

                    case Syntax.IfStatement:
                        withIndent(function() {
                            result = [
                                'if' + space + '(',
                                generateExpression(stmt.test, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                ')'
                            ];
                        });
                        if (stmt.alternate) {
                            result.push(maybeBlock(stmt.consequent));
                            result = maybeBlockSuffix(stmt.consequent, result);
                            if (stmt.alternate.type === Syntax.IfStatement) {
                                result = join(result, ['else ', generateStatement(stmt.alternate, {
                                    semicolonOptional: semicolon === ''
                                })]);
                            } else {
                                result = join(result, join('else', maybeBlock(stmt.alternate, semicolon === '')));
                            }
                        } else {
                            result.push(maybeBlock(stmt.consequent, semicolon === ''));
                        }
                        break;

                    case Syntax.ForStatement:
                        withIndent(function() {
                            result = ['for' + space + '('];
                            if (stmt.init) {
                                if (stmt.init.type === Syntax.VariableDeclaration) {
                                    result.push(generateStatement(stmt.init, {
                                        allowIn: false
                                    }));
                                } else {
                                    result.push(generateExpression(stmt.init, {
                                        precedence: Precedence.Sequence,
                                        allowIn: false,
                                        allowCall: true
                                    }), ';');
                                }
                            } else {
                                result.push(';');
                            }

                            if (stmt.test) {
                                result.push(space, generateExpression(stmt.test, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }), ';');
                            } else {
                                result.push(';');
                            }

                            if (stmt.update) {
                                result.push(space, generateExpression(stmt.update, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }), ')');
                            } else {
                                result.push(')');
                            }
                        });

                        result.push(maybeBlock(stmt.body, semicolon === ''));
                        break;

                    case Syntax.ForInStatement:
                        result = ['for' + space + '('];
                        withIndent(function() {
                            if (stmt.left.type === Syntax.VariableDeclaration) {
                                withIndent(function() {
                                    result.push(stmt.left.kind + ' ', generateStatement(stmt.left.declarations[0], {
                                        allowIn: false
                                    }));
                                });
                            } else {
                                result.push(generateExpression(stmt.left, {
                                    precedence: Precedence.Call,
                                    allowIn: true,
                                    allowCall: true
                                }));
                            }

                            result = join(result, 'in');
                            result = [join(
                                result,
                                generateExpression(stmt.right, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                })
                            ), ')'];
                        });
                        result.push(maybeBlock(stmt.body, semicolon === ''));
                        break;

                    case Syntax.LabeledStatement:
                        result = [stmt.label.name + ':', maybeBlock(stmt.body, semicolon === '')];
                        break;

                    case Syntax.Program:
                        len = stmt.body.length;
                        result = [safeConcatenation && len > 0 ? '\n' : ''];
                        for (i = 0; i < len; i += 1) {
                            fragment = addIndent(
                                generateStatement(stmt.body[i], {
                                    semicolonOptional: !safeConcatenation && i === len - 1,
                                    directiveContext: true
                                })
                            );
                            result.push(fragment);
                            if (i + 1 < len && !endsWithLineTerminator(toSourceNode(fragment).toString())) {
                                result.push(newline);
                            }
                        }
                        break;

                    case Syntax.FunctionDeclaration:
                        result = [(stmt.generator && !extra.moz.starlessGenerator ? 'function* ' : 'function ') + stmt.id.name, generateFunctionBody(stmt)];
                        break;

                    case Syntax.ReturnStatement:
                        if (stmt.argument) {
                            result = [join(
                                'return',
                                generateExpression(stmt.argument, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                })
                            ), semicolon];
                        } else {
                            result = ['return' + semicolon];
                        }
                        break;

                    case Syntax.WhileStatement:
                        withIndent(function() {
                            result = [
                                'while' + space + '(',
                                generateExpression(stmt.test, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                ')'
                            ];
                        });
                        result.push(maybeBlock(stmt.body, semicolon === ''));
                        break;

                    case Syntax.WithStatement:
                        withIndent(function() {
                            result = [
                                'with' + space + '(',
                                generateExpression(stmt.object, {
                                    precedence: Precedence.Sequence,
                                    allowIn: true,
                                    allowCall: true
                                }),
                                ')'
                            ];
                        });
                        result.push(maybeBlock(stmt.body, semicolon === ''));
                        break;

                    default:
                        throw new Error('Unknown statement type: ' + stmt.type);
                }

                // Attach comments

                if (extra.comment) {
                    result = addCommentsToStatement(stmt, result);
                }

                fragment = toSourceNode(result).toString();
                if (stmt.type === Syntax.Program && !safeConcatenation && newline === '' && fragment.charAt(fragment.length - 1) === '\n') {
                    result = toSourceNode(result).replaceRight(/\s+$/, '');
                }

                return toSourceNode(result, stmt);
            }

            function generate(node, options) {
                var defaultOptions = getDefaultOptions(),
                    result, pair;

                if (options != null) {
                    // Obsolete options
                    //
                    //   `options.indent`
                    //   `options.base`
                    //
                    // Instead of them, we can use `option.format.indent`.
                    if (typeof options.indent === 'string') {
                        defaultOptions.format.indent.style = options.indent;
                    }
                    if (typeof options.base === 'number') {
                        defaultOptions.format.indent.base = options.base;
                    }
                    options = updateDeeply(defaultOptions, options);
                    indent = options.format.indent.style;
                    if (typeof options.base === 'string') {
                        base = options.base;
                    } else {
                        base = stringRepeat(indent, options.format.indent.base);
                    }
                } else {
                    options = defaultOptions;
                    indent = options.format.indent.style;
                    base = stringRepeat(indent, options.format.indent.base);
                }
                json = options.format.json;
                renumber = options.format.renumber;
                hexadecimal = json ? false : options.format.hexadecimal;
                quotes = json ? 'double' : options.format.quotes;
                escapeless = options.format.escapeless;
                if (options.format.compact) {
                    newline = space = indent = base = '';
                } else {
                    newline = '\n';
                    space = ' ';
                }
                parentheses = options.format.parentheses;
                semicolons = options.format.semicolons;
                safeConcatenation = options.format.safeConcatenation;
                directive = options.directive;
                parse = json ? null : options.parse;
                sourceMap = options.sourceMap;
                extra = options;

                if (sourceMap) {
                    if (!exports.browser) {
                        // We assume environment is node.js
                        // And prevent from including source-map by browserify
                        SourceNode = require('source-map').SourceNode;
                    } else {
                        SourceNode = global.sourceMap.SourceNode;
                    }
                } else {
                    SourceNode = SourceNodeMock;
                }

                switch (node.type) {
                    case Syntax.BlockStatement:
                    case Syntax.BreakStatement:
                    case Syntax.CatchClause:
                    case Syntax.ContinueStatement:
                    case Syntax.DirectiveStatement:
                    case Syntax.DoWhileStatement:
                    case Syntax.DebuggerStatement:
                    case Syntax.EmptyStatement:
                    case Syntax.ExpressionStatement:
                    case Syntax.ForStatement:
                    case Syntax.ForInStatement:
                    case Syntax.FunctionDeclaration:
                    case Syntax.IfStatement:
                    case Syntax.LabeledStatement:
                    case Syntax.Program:
                    case Syntax.ReturnStatement:
                    case Syntax.SwitchStatement:
                    case Syntax.SwitchCase:
                    case Syntax.ThrowStatement:
                    case Syntax.TryStatement:
                    case Syntax.VariableDeclaration:
                    case Syntax.VariableDeclarator:
                    case Syntax.WhileStatement:
                    case Syntax.WithStatement:
                        result = generateStatement(node);
                        break;

                    case Syntax.AssignmentExpression:
                    case Syntax.ArrayExpression:
                    case Syntax.ArrayPattern:
                    case Syntax.BinaryExpression:
                    case Syntax.CallExpression:
                    case Syntax.ConditionalExpression:
                    case Syntax.FunctionExpression:
                    case Syntax.Identifier:
                    case Syntax.Literal:
                    case Syntax.LogicalExpression:
                    case Syntax.MemberExpression:
                    case Syntax.NewExpression:
                    case Syntax.ObjectExpression:
                    case Syntax.ObjectPattern:
                    case Syntax.Property:
                    case Syntax.SequenceExpression:
                    case Syntax.ThisExpression:
                    case Syntax.UnaryExpression:
                    case Syntax.UpdateExpression:
                    case Syntax.YieldExpression:

                        result = generateExpression(node, {
                            precedence: Precedence.Sequence,
                            allowIn: true,
                            allowCall: true
                        });
                        break;

                    default:
                        throw new Error('Unknown node type: ' + node.type);
                }

                if (!sourceMap) {
                    return result.toString();
                }

                pair = result.toStringWithSourceMap({
                    file: options.sourceMap,
                    sourceRoot: options.sourceMapRoot
                });

                if (options.sourceMapWithCode) {
                    return pair;
                }
                return pair.map.toString();
            }

            // simple visitor implementation

            VisitorKeys = {
                AssignmentExpression: ['left', 'right'],
                ArrayExpression: ['elements'],
                ArrayPattern: ['elements'],
                BlockStatement: ['body'],
                BinaryExpression: ['left', 'right'],
                BreakStatement: ['label'],
                CallExpression: ['callee', 'arguments'],
                CatchClause: ['param', 'body'],
                ConditionalExpression: ['test', 'consequent', 'alternate'],
                ContinueStatement: ['label'],
                DirectiveStatement: [],
                DoWhileStatement: ['body', 'test'],
                DebuggerStatement: [],
                EmptyStatement: [],
                ExpressionStatement: ['expression'],
                ForStatement: ['init', 'test', 'update', 'body'],
                ForInStatement: ['left', 'right', 'body'],
                FunctionDeclaration: ['id', 'params', 'body'],
                FunctionExpression: ['id', 'params', 'body'],
                Identifier: [],
                IfStatement: ['test', 'consequent', 'alternate'],
                Literal: [],
                LabeledStatement: ['label', 'body'],
                LogicalExpression: ['left', 'right'],
                MemberExpression: ['object', 'property'],
                NewExpression: ['callee', 'arguments'],
                ObjectExpression: ['properties'],
                ObjectPattern: ['properties'],
                Program: ['body'],
                Property: ['key', 'value'],
                ReturnStatement: ['argument'],
                SequenceExpression: ['expressions'],
                SwitchStatement: ['discriminant', 'cases'],
                SwitchCase: ['test', 'consequent'],
                ThisExpression: [],
                ThrowStatement: ['argument'],
                TryStatement: ['block', 'handlers', 'finalizer'],
                UnaryExpression: ['argument'],
                UpdateExpression: ['argument'],
                VariableDeclaration: ['declarations'],
                VariableDeclarator: ['id', 'init'],
                WhileStatement: ['test', 'body'],
                WithStatement: ['object', 'body'],
                YieldExpression: ['argument']
            };

            VisitorOption = {
                Break: 1,
                Skip: 2
            };

            // based on LLVM libc++ upper_bound / lower_bound
            // MIT License

            function upperBound(array, func) {
                var diff, len, i, current;

                len = array.length;
                i = 0;

                while (len) {
                    diff = len >>> 1;
                    current = i + diff;
                    if (func(array[current])) {
                        len = diff;
                    } else {
                        i = current + 1;
                        len -= diff + 1;
                    }
                }
                return i;
            }

            function lowerBound(array, func) {
                var diff, len, i, current;

                len = array.length;
                i = 0;

                while (len) {
                    diff = len >>> 1;
                    current = i + diff;
                    if (func(array[current])) {
                        i = current + 1;
                        len -= diff + 1;
                    } else {
                        len = diff;
                    }
                }
                return i;
            }

            function extendCommentRange(comment, tokens) {
                var target, token;

                target = upperBound(tokens, function search(token) {
                    return token.range[0] > comment.range[0];
                });

                comment.extendedRange = [comment.range[0], comment.range[1]];

                if (target !== tokens.length) {
                    comment.extendedRange[1] = tokens[target].range[0];
                }

                target -= 1;
                if (target >= 0) {
                    if (target < tokens.length) {
                        comment.extendedRange[0] = tokens[target].range[1];
                    } else if (token.length) {
                        comment.extendedRange[1] = tokens[tokens.length - 1].range[0];
                    }
                }

                return comment;
            }

            function attachComments(tree, providedComments, tokens) {
                // At first, we should calculate extended comment ranges.
                var comments = [],
                    comment, len, i;

                if (!tree.range) {
                    throw new Error('attachComments needs range information');
                }

                // tokens array is empty, we attach comments to tree as 'leadingComments'
                if (!tokens.length) {
                    if (providedComments.length) {
                        for (i = 0, len = providedComments.length; i < len; i += 1) {
                            comment = deepCopy(providedComments[i]);
                            comment.extendedRange = [0, tree.range[0]];
                            comments.push(comment);
                        }
                        tree.leadingComments = comments;
                    }
                    return tree;
                }

                for (i = 0, len = providedComments.length; i < len; i += 1) {
                    comments.push(extendCommentRange(deepCopy(providedComments[i]), tokens));
                }

                // This is based on John Freeman's implementation.
                traverse(tree, {
                    cursor: 0,
                    enter: function(node) {
                        var comment;

                        while (this.cursor < comments.length) {
                            comment = comments[this.cursor];
                            if (comment.extendedRange[1] > node.range[0]) {
                                break;
                            }

                            if (comment.extendedRange[1] === node.range[0]) {
                                if (!node.leadingComments) {
                                    node.leadingComments = [];
                                }
                                node.leadingComments.push(comment);
                                comments.splice(this.cursor, 1);
                            } else {
                                this.cursor += 1;
                            }
                        }

                        // already out of owned node
                        if (this.cursor === comments.length) {
                            return VisitorOption.Break;
                        }

                        if (comments[this.cursor].extendedRange[0] > node.range[1]) {
                            return VisitorOption.Skip;
                        }
                    }
                });

                traverse(tree, {
                    cursor: 0,
                    leave: function(node) {
                        var comment;

                        while (this.cursor < comments.length) {
                            comment = comments[this.cursor];
                            if (node.range[1] < comment.extendedRange[0]) {
                                break;
                            }

                            if (node.range[1] === comment.extendedRange[0]) {
                                if (!node.trailingComments) {
                                    node.trailingComments = [];
                                }
                                node.trailingComments.push(comment);
                                comments.splice(this.cursor, 1);
                            } else {
                                this.cursor += 1;
                            }
                        }

                        // already out of owned node
                        if (this.cursor === comments.length) {
                            return VisitorOption.Break;
                        }

                        if (comments[this.cursor].extendedRange[0] > node.range[1]) {
                            return VisitorOption.Skip;
                        }
                    }
                });

                return tree;
            }

            // Sync with package.json.
            exports.version = '0.0.16-dev';

            exports.generate = generate;
            exports.attachComments = attachComments;
            exports.browser = false;
        }());
        /* vim: set sw=4 ts=4 et tw=80 : */

    });

    require.define("/node_modules/estraverse/package.json", function(require, module, exports, __dirname, __filename, process, global) {
        module.exports = {
            "main": "estraverse.js"
        }
    });

    require.define("/node_modules/estraverse/estraverse.js", function(require, module, exports, __dirname, __filename, process, global) {
        /*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

        /*jslint bitwise:true */
        /*global exports:true, define:true, window:true */
        (function(factory) {
            'use strict';

            // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
            // and plain browser loading,
            if (typeof define === 'function' && define.amd) {
                define(['exports'], factory);
            } else if (typeof exports !== 'undefined') {
                factory(exports);
            } else {
                factory((window.estraverse = {}));
            }
        }(function(exports) {
            'use strict';

            var Syntax,
                isArray,
                VisitorOption,
                VisitorKeys,
                wrappers;

            Syntax = {
                AssignmentExpression: 'AssignmentExpression',
                ArrayExpression: 'ArrayExpression',
                BlockStatement: 'BlockStatement',
                BinaryExpression: 'BinaryExpression',
                BreakStatement: 'BreakStatement',
                CallExpression: 'CallExpression',
                CatchClause: 'CatchClause',
                ConditionalExpression: 'ConditionalExpression',
                ContinueStatement: 'ContinueStatement',
                DebuggerStatement: 'DebuggerStatement',
                DirectiveStatement: 'DirectiveStatement',
                DoWhileStatement: 'DoWhileStatement',
                EmptyStatement: 'EmptyStatement',
                ExpressionStatement: 'ExpressionStatement',
                ForStatement: 'ForStatement',
                ForInStatement: 'ForInStatement',
                FunctionDeclaration: 'FunctionDeclaration',
                FunctionExpression: 'FunctionExpression',
                Identifier: 'Identifier',
                IfStatement: 'IfStatement',
                Literal: 'Literal',
                LabeledStatement: 'LabeledStatement',
                LogicalExpression: 'LogicalExpression',
                MemberExpression: 'MemberExpression',
                NewExpression: 'NewExpression',
                ObjectExpression: 'ObjectExpression',
                Program: 'Program',
                Property: 'Property',
                ReturnStatement: 'ReturnStatement',
                SequenceExpression: 'SequenceExpression',
                SwitchStatement: 'SwitchStatement',
                SwitchCase: 'SwitchCase',
                ThisExpression: 'ThisExpression',
                ThrowStatement: 'ThrowStatement',
                TryStatement: 'TryStatement',
                UnaryExpression: 'UnaryExpression',
                UpdateExpression: 'UpdateExpression',
                VariableDeclaration: 'VariableDeclaration',
                VariableDeclarator: 'VariableDeclarator',
                WhileStatement: 'WhileStatement',
                WithStatement: 'WithStatement'
            };

            isArray = Array.isArray;
            if (!isArray) {
                isArray = function isArray(array) {
                    return Object.prototype.toString.call(array) === '[object Array]';
                };
            }

            VisitorKeys = {
                AssignmentExpression: ['left', 'right'],
                ArrayExpression: ['elements'],
                BlockStatement: ['body'],
                BinaryExpression: ['left', 'right'],
                BreakStatement: ['label'],
                CallExpression: ['callee', 'arguments'],
                CatchClause: ['param', 'body'],
                ConditionalExpression: ['test', 'consequent', 'alternate'],
                ContinueStatement: ['label'],
                DebuggerStatement: [],
                DirectiveStatement: [],
                DoWhileStatement: ['body', 'test'],
                EmptyStatement: [],
                ExpressionStatement: ['expression'],
                ForStatement: ['init', 'test', 'update', 'body'],
                ForInStatement: ['left', 'right', 'body'],
                FunctionDeclaration: ['id', 'params', 'body'],
                FunctionExpression: ['id', 'params', 'body'],
                Identifier: [],
                IfStatement: ['test', 'consequent', 'alternate'],
                Literal: [],
                LabeledStatement: ['label', 'body'],
                LogicalExpression: ['left', 'right'],
                MemberExpression: ['object', 'property'],
                NewExpression: ['callee', 'arguments'],
                ObjectExpression: ['properties'],
                Program: ['body'],
                Property: ['key', 'value'],
                ReturnStatement: ['argument'],
                SequenceExpression: ['expressions'],
                SwitchStatement: ['discriminant', 'cases'],
                SwitchCase: ['test', 'consequent'],
                ThisExpression: [],
                ThrowStatement: ['argument'],
                TryStatement: ['block', 'handlers', 'finalizer'],
                UnaryExpression: ['argument'],
                UpdateExpression: ['argument'],
                VariableDeclaration: ['declarations'],
                VariableDeclarator: ['id', 'init'],
                WhileStatement: ['test', 'body'],
                WithStatement: ['object', 'body']
            };

            VisitorOption = {
                Break: 1,
                Skip: 2
            };

            wrappers = {
                PropertyWrapper: 'Property'
            };

            function traverse(top, visitor) {
                var worklist, leavelist, node, nodeType, ret, current, current2, candidates, candidate, marker = {};

                worklist = [top];
                leavelist = [null];

                while (worklist.length) {
                    node = worklist.pop();
                    nodeType = node.type;

                    if (node === marker) {
                        node = leavelist.pop();
                        if (visitor.leave) {
                            ret = visitor.leave(node, leavelist[leavelist.length - 1]);
                        } else {
                            ret = undefined;
                        }
                        if (ret === VisitorOption.Break) {
                            return;
                        }
                    } else if (node) {
                        if (wrappers.hasOwnProperty(nodeType)) {
                            node = node.node;
                            nodeType = wrappers[nodeType];
                        }

                        if (visitor.enter) {
                            ret = visitor.enter(node, leavelist[leavelist.length - 1]);
                        } else {
                            ret = undefined;
                        }

                        if (ret === VisitorOption.Break) {
                            return;
                        }

                        worklist.push(marker);
                        leavelist.push(node);

                        if (ret !== VisitorOption.Skip) {
                            candidates = VisitorKeys[nodeType];
                            current = candidates.length;
                            while ((current -= 1) >= 0) {
                                candidate = node[candidates[current]];
                                if (candidate) {
                                    if (isArray(candidate)) {
                                        current2 = candidate.length;
                                        while ((current2 -= 1) >= 0) {
                                            if (candidate[current2]) {
                                                if (nodeType === Syntax.ObjectExpression && 'properties' === candidates[current] && null == candidates[current].type) {
                                                    worklist.push({
                                                        type: 'PropertyWrapper',
                                                        node: candidate[current2]
                                                    });
                                                } else {
                                                    worklist.push(candidate[current2]);
                                                }
                                            }
                                        }
                                    } else {
                                        worklist.push(candidate);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            function replace(top, visitor) {
                var worklist, leavelist, node, nodeType, target, tuple, ret, current, current2, candidates, candidate, marker = {}, result;

                result = {
                    top: top
                };

                tuple = [top, result, 'top'];
                worklist = [tuple];
                leavelist = [tuple];

                function notify(v) {
                    ret = v;
                }

                while (worklist.length) {
                    tuple = worklist.pop();

                    if (tuple === marker) {
                        tuple = leavelist.pop();
                        ret = undefined;
                        if (visitor.leave) {
                            node = tuple[0];
                            target = visitor.leave(tuple[0], leavelist[leavelist.length - 1][0], notify);
                            if (target !== undefined) {
                                node = target;
                            }
                            tuple[1][tuple[2]] = node;
                        }
                        if (ret === VisitorOption.Break) {
                            return result.top;
                        }
                    } else if (tuple[0]) {
                        ret = undefined;
                        node = tuple[0];

                        nodeType = node.type;
                        if (wrappers.hasOwnProperty(nodeType)) {
                            tuple[0] = node = node.node;
                            nodeType = wrappers[nodeType];
                        }

                        if (visitor.enter) {
                            target = visitor.enter(tuple[0], leavelist[leavelist.length - 1][0], notify);
                            if (target !== undefined) {
                                node = target;
                            }
                            tuple[1][tuple[2]] = node;
                            tuple[0] = node;
                        }

                        if (ret === VisitorOption.Break) {
                            return result.top;
                        }

                        if (tuple[0]) {
                            worklist.push(marker);
                            leavelist.push(tuple);

                            if (ret !== VisitorOption.Skip) {
                                candidates = VisitorKeys[nodeType];
                                current = candidates.length;
                                while ((current -= 1) >= 0) {
                                    candidate = node[candidates[current]];
                                    if (candidate) {
                                        if (isArray(candidate)) {
                                            current2 = candidate.length;
                                            while ((current2 -= 1) >= 0) {
                                                if (candidate[current2]) {
                                                    if (nodeType === Syntax.ObjectExpression && 'properties' === candidates[current] && null == candidates[current].type) {
                                                        worklist.push([{
                                                                type: 'PropertyWrapper',
                                                                node: candidate[current2]
                                                            },
                                                            candidate, current2
                                                        ]);
                                                    } else {
                                                        worklist.push([candidate[current2], candidate, current2]);
                                                    }
                                                }
                                            }
                                        } else {
                                            worklist.push([candidate, node, candidates[current]]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                return result.top;
            }

            exports.version = '0.0.4';
            exports.Syntax = Syntax;
            exports.traverse = traverse;
            exports.replace = replace;
            exports.VisitorKeys = VisitorKeys;
            exports.VisitorOption = VisitorOption;
        }));
        /* vim: set sw=4 ts=4 et tw=80 : */

    });

    require.define("/tools/entry-point.js", function(require, module, exports, __dirname, __filename, process, global) {
        /*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

        (function() {
            'use strict';
            var escodegen;
            escodegen = self.escodegen = require('../escodegen');
            escodegen.browser = true;
        }());

    });
    require("/tools/entry-point.js");
})();

/*
 Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/*global esprima, escodegen, window */
(function (isNode) {
    "use strict";
    var SYNTAX,
        nodeType,
        ESP = isNode ? require('esprima') : esprima,
        ESPGEN = isNode ? require('escodegen') : escodegen,  //TODO - package as dependency
        crypto = isNode ? require('crypto') : null,
        LEADER_WRAP = '(function () { ',
        TRAILER_WRAP = '\n}());',
        COMMENT_RE = /^\s*istanbul\s+ignore\s+(if|else|next)(?=\W|$)/,
        astgen,
        preconditions,
        cond,
        isArray = Array.isArray;

    /* istanbul ignore if: untestable */
    if (!isArray) {
        isArray = function (thing) { return thing &&  Object.prototype.toString.call(thing) === '[object Array]'; };
    }

    if (!isNode) {
        preconditions = {
            'Could not find esprima': ESP,
            'Could not find escodegen': ESPGEN,
            'JSON object not in scope': JSON,
            'Array does not implement push': [].push,
            'Array does not implement unshift': [].unshift
        };
        /* istanbul ignore next: untestable */
        for (cond in preconditions) {
            if (preconditions.hasOwnProperty(cond)) {
                if (!preconditions[cond]) { throw new Error(cond); }
            }
        }
    }

    function generateTrackerVar(filename, omitSuffix) {
        var hash, suffix;
        if (crypto !== null) {
            hash = crypto.createHash('md5');
            hash.update(filename);
            suffix = hash.digest('base64');
            //trim trailing equal signs, turn identifier unsafe chars to safe ones + => _ and / => $
            suffix = suffix.replace(new RegExp('=', 'g'), '')
                .replace(new RegExp('\\+', 'g'), '_')
                .replace(new RegExp('/', 'g'), '$');
        } else {
            self.__cov_seq = self.__cov_seq || 0;
            self.__cov_seq += 1;
            suffix = self.__cov_seq;
        }
        return '__cov_' + (omitSuffix ? '' : suffix);
    }

    function pushAll(ary, thing) {
        if (!isArray(thing)) {
            thing = [ thing ];
        }
        Array.prototype.push.apply(ary, thing);
    }

    SYNTAX = {
        ArrayExpression: [ 'elements' ],
        AssignmentExpression: ['left', 'right'],
        BinaryExpression: ['left', 'right' ],
        BlockStatement: [ 'body' ],
        BreakStatement: [ 'label' ],
        CallExpression: [ 'callee', 'arguments'],
        CatchClause: ['param', 'body'],
        ConditionalExpression: [ 'test', 'consequent', 'alternate' ],
        ContinueStatement: [ 'label' ],
        DebuggerStatement: [ ],
        DoWhileStatement: [ 'body', 'test' ],
        EmptyStatement: [],
        ExpressionStatement: [ 'expression'],
        ForInStatement: [ 'left', 'right', 'body' ],
        ForStatement: ['init', 'test', 'update', 'body' ],
        FunctionDeclaration: ['id', 'params', 'body'],
        FunctionExpression: ['id', 'params', 'defaults', 'body'],
        Identifier: [],
        IfStatement: ['test', 'consequent', 'alternate'],
        LabeledStatement: ['label', 'body'],
        Literal: [],
        LogicalExpression: [ 'left', 'right' ],
        MemberExpression: ['object', 'property'],
        NewExpression: ['callee', 'arguments'],
        ObjectExpression: [ 'properties' ],
        Program: [ 'body' ],
        Property: [ 'key', 'value'],
        ReturnStatement: ['argument'],
        SequenceExpression: ['expressions'],
        SwitchCase: [ 'test', 'consequent' ],
        SwitchStatement: ['discriminant', 'cases' ],
        ThisExpression: [],
        ThrowStatement: ['argument'],
        TryStatement: [ 'block', 'handlers', 'finalizer' ],
        UnaryExpression: ['argument'],
        UpdateExpression: [ 'argument' ],
        VariableDeclaration: [ 'declarations' ],
        VariableDeclarator: [ 'id', 'init' ],
        WhileStatement: [ 'test', 'body' ],
        WithStatement: [ 'object', 'body' ]

    };

    for (nodeType in SYNTAX) {
        /* istanbul ignore else: has own property */
        if (SYNTAX.hasOwnProperty(nodeType)) {
            SYNTAX[nodeType] = { name: nodeType, children: SYNTAX[nodeType] };
        }
    }

    astgen = {
        variable: function (name) { return { type: SYNTAX.Identifier.name, name: name }; },
        stringLiteral: function (str) { return { type: SYNTAX.Literal.name, value: String(str) }; },
        numericLiteral: function (num) { return { type: SYNTAX.Literal.name, value: Number(num) }; },
        statement: function (contents) { return { type: SYNTAX.ExpressionStatement.name, expression: contents }; },
        dot: function (obj, field) { return { type: SYNTAX.MemberExpression.name, computed: false, object: obj, property: field }; },
        subscript: function (obj, sub) { return { type: SYNTAX.MemberExpression.name, computed: true, object: obj, property: sub }; },
        postIncrement: function (obj) { return { type: SYNTAX.UpdateExpression.name, operator: '++', prefix: false, argument: obj }; },
        sequence: function (one, two) { return { type: SYNTAX.SequenceExpression.name, expressions: [one, two] }; }
    };

    function Walker(walkMap, preprocessor, scope, debug) {
        this.walkMap = walkMap;
        this.preprocessor = preprocessor;
        this.scope = scope;
        this.debug = debug;
        if (this.debug) {
            this.level = 0;
            this.seq = true;
        }
    }

    function defaultWalker(node, walker) {

        var type = node.type,
            preprocessor,
            postprocessor,
            children = SYNTAX[type].children,
            // don't run generated nodes thru custom walks otherwise we will attempt to instrument the instrumentation code :)
            applyCustomWalker = !!node.loc || node.type === SYNTAX.Program.name,
            walkerFn = applyCustomWalker ? walker.walkMap[type] : null,
            i,
            j,
            walkFnIndex,
            childType,
            childNode,
            ret,
            childArray,
            childElement,
            pathElement,
            assignNode,
            isLast;

        /* istanbul ignore if: guard */
        if (node.walking) { throw new Error('Infinite regress: Custom walkers may NOT call walker.apply(node)'); }
        node.walking = true;

        ret = walker.apply(node, walker.preprocessor);

        preprocessor = ret.preprocessor;
        if (preprocessor) {
            delete ret.preprocessor;
            ret = walker.apply(node, preprocessor);
        }

        if (isArray(walkerFn)) {
            for (walkFnIndex = 0; walkFnIndex < walkerFn.length; walkFnIndex += 1) {
                isLast = walkFnIndex === walkerFn.length - 1;
                ret = walker.apply(ret, walkerFn[walkFnIndex]);
                /*istanbul ignore next: paranoid check */
                if (ret.type !== type && !isLast) {
                    throw new Error('Only the last walker is allowed to change the node type: [type was: ' + type + ' ]');
                }
            }
        } else {
            if (walkerFn) {
                ret = walker.apply(node, walkerFn);
            }
        }

        for (i = 0; i < children.length; i += 1) {
            childType = children[i];
            childNode = node[childType];
            if (childNode && !childNode.skipWalk) {
                pathElement = { node: node, property: childType };
                if (isArray(childNode)) {
                    childArray = [];
                    for (j = 0; j < childNode.length; j += 1) {
                        childElement = childNode[j];
                        pathElement.index = j;
                        if (childElement) {
                          assignNode = walker.apply(childElement, null, pathElement);
                          if (isArray(assignNode.prepend)) {
                              pushAll(childArray, assignNode.prepend);
                              delete assignNode.prepend;
                          }
                        }
                        pushAll(childArray, assignNode);
                    }
                    node[childType] = childArray;
                } else {
                    assignNode = walker.apply(childNode, null, pathElement);
                    /*istanbul ignore if: paranoid check */
                    if (isArray(assignNode.prepend)) {
                        throw new Error('Internal error: attempt to prepend statements in disallowed (non-array) context');
                        /* if this should be allowed, this is how to solve it
                        tmpNode = { type: 'BlockStatement', body: [] };
                        pushAll(tmpNode.body, assignNode.prepend);
                        pushAll(tmpNode.body, assignNode);
                        node[childType] = tmpNode;
                        delete assignNode.prepend;
                        */
                    } else {
                        node[childType] = assignNode;
                    }
                }
            }
        }

        postprocessor = ret.postprocessor;
        if (postprocessor) {
            delete ret.postprocessor;
            ret = walker.apply(ret, postprocessor);
        }

        delete node.walking;

        return ret;
    }

    Walker.prototype = {
        startWalk: function (node) {
            this.path = [];
            this.apply(node);
        },

        apply: function (node, walkFn, pathElement) {
            var ret, i, seq, prefix;

            walkFn = walkFn || defaultWalker;
            if (this.debug) {
                this.seq += 1;
                this.level += 1;
                seq = this.seq;
                prefix = '';
                for (i = 0; i < this.level; i += 1) { prefix += '    '; }
                console.log(prefix + 'Enter (' + seq + '):' + node.type);
            }
            if (pathElement) { this.path.push(pathElement); }
            ret = walkFn.call(this.scope, node, this);
            if (pathElement) { this.path.pop(); }
            if (this.debug) {
                this.level -= 1;
                console.log(prefix + 'Return (' + seq + '):' + node.type);
            }
            return ret || node;
        },

        startLineForNode: function (node) {
            return node && node.loc && node.loc.start ? node.loc.start.line : /* istanbul ignore next: guard */ null;
        },

        ancestor: function (n) {
            return this.path.length > n - 1 ? this.path[this.path.length - n] : /* istanbul ignore next: guard */ null;
        },

        parent: function () {
            return this.ancestor(1);
        },

        isLabeled: function () {
            var el = this.parent();
            return el && el.node.type === SYNTAX.LabeledStatement.name;
        }
    };

    /**
     * mechanism to instrument code for coverage. It uses the `esprima` and
     * `escodegen` libraries for JS parsing and code generation respectively.
     *
     * Works on `node` as well as the browser.
     *
     * Usage on nodejs
     * ---------------
     *
     *      var instrumenter = new require('istanbul').Instrumenter(),
     *          changed = instrumenter.instrumentSync('function meaningOfLife() { return 42; }', 'filename.js');
     *
     * Usage in a browser
     * ------------------
     *
     * Load `esprima.js`, `escodegen.js` and `instrumenter.js` (this file) using `script` tags or other means.
     *
     * Create an instrumenter object as:
     *
     *      var instrumenter = new Instrumenter(),
     *          changed = instrumenter.instrumentSync('function meaningOfLife() { return 42; }', 'filename.js');
     *
     * Aside from demonstration purposes, it is unclear why you would want to instrument code in a browser.
     *
     * @class Instrumenter
     * @constructor
     * @param {Object} options Optional. Configuration options.
     * @param {String} [options.coverageVariable] the global variable name to use for
     *      tracking coverage. Defaults to `__coverage__`
     * @param {Boolean} [options.embedSource] whether to embed the source code of every
     *      file as an array in the file coverage object for that file. Defaults to `false`
     * @param {Boolean} [options.preserveComments] whether comments should be preserved in the output. Defaults to `false`
     * @param {Boolean} [options.noCompact] emit readable code when set. Defaults to `false`
     * @param {Boolean} [options.noAutoWrap] do not automatically wrap the source in
     *      an anonymous function before covering it. By default, code is wrapped in
     *      an anonymous function before it is parsed. This is done because
     *      some nodejs libraries have `return` statements outside of
     *      a function which is technically invalid Javascript and causes the parser to fail.
     *      This construct, however, works correctly in node since module loading
     *      is done in the context of an anonymous function.
     *
     * Note that the semantics of the code *returned* by the instrumenter does not change in any way.
     * The function wrapper is "unwrapped" before the instrumented code is generated.
     * @param {Object} [options.codeGenerationOptions] an object that is directly passed to the `escodegen`
     *      library as configuration for code generation. The `noCompact` setting is not honored when this
     *      option is specified
     * @param {Boolean} [options.debug] assist in debugging. Currently, the only effect of
     *      setting this option is a pretty-print of the coverage variable. Defaults to `false`
     * @param {Boolean} [options.walkDebug] assist in debugging of the AST walker used by this class.
     *
     */
    function Instrumenter(options) {
        this.opts = options || {
            debug: false,
            walkDebug: false,
            coverageVariable: '__coverage__',
            codeGenerationOptions: undefined,
            noAutoWrap: false,
            noCompact: false,
            embedSource: false,
            preserveComments: false
        };

        this.walker = new Walker({
            ExpressionStatement: this.coverStatement,
            BreakStatement: this.coverStatement,
            ContinueStatement: this.coverStatement,
            DebuggerStatement: this.coverStatement,
            ReturnStatement: this.coverStatement,
            ThrowStatement: this.coverStatement,
            TryStatement: this.coverStatement,
            VariableDeclaration: this.coverStatement,
            IfStatement: [ this.ifBlockConverter, this.coverStatement, this.ifBranchInjector ],
            ForStatement: [ this.skipInit, this.loopBlockConverter, this.coverStatement ],
            ForInStatement: [ this.skipLeft, this.loopBlockConverter, this.coverStatement ],
            WhileStatement: [ this.loopBlockConverter, this.coverStatement ],
            DoWhileStatement: [ this.loopBlockConverter, this.coverStatement ],
            SwitchStatement: [ this.coverStatement, this.switchBranchInjector ],
            SwitchCase: [ this.switchCaseInjector ],
            WithStatement: [ this.withBlockConverter, this.coverStatement ],
            FunctionDeclaration: [ this.coverFunction, this.coverStatement ],
            FunctionExpression: this.coverFunction,
            LabeledStatement: this.coverStatement,
            ConditionalExpression: this.conditionalBranchInjector,
            LogicalExpression: this.logicalExpressionBranchInjector,
            ObjectExpression: this.maybeAddType
        }, this.extractCurrentHint, this, this.opts.walkDebug);

        //unit testing purposes only
        if (this.opts.backdoor && this.opts.backdoor.omitTrackerSuffix) {
            this.omitTrackerSuffix = true;
        }
    }

    Instrumenter.prototype = {
        /**
         * synchronous instrumentation method. Throws when illegal code is passed to it
         * @method instrumentSync
         * @param {String} code the code to be instrumented as a String
         * @param {String} filename Optional. The name of the file from which
         *  the code was read. A temporary filename is generated when not specified.
         *  Not specifying a filename is only useful for unit tests and demonstrations
         *  of this library.
         */
        instrumentSync: function (code, filename) {
            var program;

            //protect from users accidentally passing in a Buffer object instead
            if (typeof code !== 'string') { throw new Error('Code must be string'); }
            if (code.charAt(0) === '#') { //shebang, 'comment' it out, won't affect syntax tree locations for things we care about
                code = '//' + code;
            }
            if (!this.opts.noAutoWrap) {
                code = LEADER_WRAP + code + TRAILER_WRAP;
            }
            program = ESP.parse(code, {
                loc: true,
                range: true,
                tokens: this.opts.preserveComments,
                comment: true
            });
            if (this.opts.preserveComments) {
                program = ESPGEN.attachComments(program, program.comments, program.tokens);
            }
            if (!this.opts.noAutoWrap) {
                program = {
                    type: SYNTAX.Program.name,
                    body: program.body[0].expression.callee.body.body,
                    comments: program.comments
                };
            }
            return this.instrumentASTSync(program, filename, code);
        },
        filterHints: function (comments) {
            var ret = [],
                i,
                comment,
                groups;
            if (!(comments && isArray(comments))) {
                return ret;
            }
            for (i = 0; i < comments.length; i += 1) {
                comment = comments[i];
                /* istanbul ignore else: paranoid check */
                if (comment && comment.value && comment.range && isArray(comment.range)) {
                    groups = String(comment.value).match(COMMENT_RE);
                    if (groups) {
                        ret.push({ type: groups[1], start: comment.range[0], end: comment.range[1] });
                    }
                }
            }
            return ret;
        },
        extractCurrentHint: function (node) {
            if (!node.range) { return; }
            var i = this.currentState.lastHintPosition + 1,
                hints = this.currentState.hints,
                nodeStart = node.range[0],
                hint;
            this.currentState.currentHint = null;
            while (i < hints.length) {
                hint = hints[i];
                if (hint.end < nodeStart) {
                    this.currentState.currentHint = hint;
                    this.currentState.lastHintPosition = i;
                    i += 1;
                } else {
                    break;
                }
            }
        },
        /**
         * synchronous instrumentation method that instruments an AST instead.
         * @method instrumentASTSync
         * @param {String} program the AST to be instrumented
         * @param {String} filename Optional. The name of the file from which
         *  the code was read. A temporary filename is generated when not specified.
         *  Not specifying a filename is only useful for unit tests and demonstrations
         *  of this library.
         *  @param {String} originalCode the original code corresponding to the AST,
         *  used for embedding the source into the coverage object
         */
        instrumentASTSync: function (program, filename, originalCode) {
            var usingStrict = false,
                codegenOptions,
                generated,
                preamble,
                lineCount,
                i;
            filename = filename || String(new Date().getTime()) + '.js';
            this.sourceMap = null;
            this.coverState = {
                path: filename,
                s: {},
                b: {},
                f: {},
                fnMap: {},
                statementMap: {},
                branchMap: {}
            };
            this.currentState = {
                trackerVar: generateTrackerVar(filename, this.omitTrackerSuffix),
                func: 0,
                branch: 0,
                variable: 0,
                statement: 0,
                hints: this.filterHints(program.comments),
                currentHint: null,
                lastHintPosition: -1,
                ignoring: 0
            };
            if (program.body && program.body.length > 0 && this.isUseStrictExpression(program.body[0])) {
                //nuke it
                program.body.shift();
                //and add it back at code generation time
                usingStrict = true;
            }
            this.walker.startWalk(program);
            codegenOptions = this.opts.codeGenerationOptions || { format: { compact: !this.opts.noCompact }};
            codegenOptions.comment = this.opts.preserveComments;
            //console.log(JSON.stringify(program, undefined, 2));

            generated = ESPGEN.generate(program, codegenOptions);
            preamble = this.getPreamble(originalCode || '', usingStrict);

            if (generated.map && generated.code) {
                lineCount = preamble.split(/\r\n|\r|\n/).length;
                // offset all the generated line numbers by the number of lines in the preamble
                for (i = 0; i < generated.map._mappings.length; i += 1) {
                    generated.map._mappings[i].generatedLine += lineCount;
                }
                this.sourceMap = generated.map;
                generated = generated.code;
            }

            return preamble + '\n' + generated + '\n';
        },
        /**
         * Callback based instrumentation. Note that this still executes synchronously in the same process tick
         * and calls back immediately. It only provides the options for callback style error handling as
         * opposed to a `try-catch` style and nothing more. Implemented as a wrapper over `instrumentSync`
         *
         * @method instrument
         * @param {String} code the code to be instrumented as a String
         * @param {String} filename Optional. The name of the file from which
         *  the code was read. A temporary filename is generated when not specified.
         *  Not specifying a filename is only useful for unit tests and demonstrations
         *  of this library.
         * @param {Function(err, instrumentedCode)} callback - the callback function
         */
        instrument: function (code, filename, callback) {

            if (!callback && typeof filename === 'function') {
                callback = filename;
                filename = null;
            }
            try {
                callback(null, this.instrumentSync(code, filename));
            } catch (ex) {
                callback(ex);
            }
        },
        /**
         * returns the file coverage object for the code that was instrumented
         * just before calling this method. Note that this represents a
         * "zero-coverage" object which is not even representative of the code
         * being loaded in node or a browser (which would increase the statement
         * counts for mainline code).
         * @method lastFileCoverage
         * @return {Object} a "zero-coverage" file coverage object for the code last instrumented
         * by this instrumenter
         */
        lastFileCoverage: function () {
            return this.coverState;
        },
        /**
         * returns the source map object for the code that was instrumented
         * just before calling this method.
         * @method lastSourceMap
         * @return {Object} a source map object for the code last instrumented
         * by this instrumenter
         */
        lastSourceMap: function () {
            return this.sourceMap;
        },
        fixColumnPositions: function (coverState) {
            var offset = LEADER_WRAP.length,
                fixer = function (loc) {
                    if (loc.start.line === 1) {
                        loc.start.column -= offset;
                    }
                    if (loc.end.line === 1) {
                        loc.end.column -= offset;
                    }
                },
                k,
                obj,
                i,
                locations;

            obj = coverState.statementMap;
            for (k in obj) {
                /* istanbul ignore else: has own property */
                if (obj.hasOwnProperty(k)) { fixer(obj[k]); }
            }
            obj = coverState.fnMap;
            for (k in obj) {
                /* istanbul ignore else: has own property */
                if (obj.hasOwnProperty(k)) { fixer(obj[k].loc); }
            }
            obj = coverState.branchMap;
            for (k in obj) {
                /* istanbul ignore else: has own property */
                if (obj.hasOwnProperty(k)) {
                    locations = obj[k].locations;
                    for (i = 0; i < locations.length; i += 1) {
                        fixer(locations[i]);
                    }
                }
            }
        },

        getPreamble: function (sourceCode, emitUseStrict) {
            var varName = this.opts.coverageVariable || '__coverage__',
                file = this.coverState.path.replace(/\\/g, '\\\\'),
                tracker = this.currentState.trackerVar,
                coverState,
                strictLine = emitUseStrict ? '"use strict";' : '',
                // return replacements using the function to ensure that the replacement is
                // treated like a dumb string and not as a string with RE replacement patterns
                replacer = function (s) {
                    return function () { return s; };
                },
                code;
            if (!this.opts.noAutoWrap) {
                this.fixColumnPositions(this.coverState);
            }
            if (this.opts.embedSource) {
                this.coverState.code = sourceCode.split(/(?:\r?\n)|\r/);
            }
            coverState = this.opts.debug ? JSON.stringify(this.coverState, undefined, 4) : JSON.stringify(this.coverState);
            code = [
                "%STRICT%",
                "var %VAR% = (Function('return this'))();",
                "if (!%VAR%.%GLOBAL%) { %VAR%.%GLOBAL% = {}; }",
                "%VAR% = %VAR%.%GLOBAL%;",
                "if (!(%VAR%['%FILE%'])) {",
                "   %VAR%['%FILE%'] = %OBJECT%;",
                "}",
                "%VAR% = %VAR%['%FILE%'];"
            ].join("\n")
                .replace(/%STRICT%/g, replacer(strictLine))
                .replace(/%VAR%/g, replacer(tracker))
                .replace(/%GLOBAL%/g, replacer(varName))
                .replace(/%FILE%/g, replacer(file))
                .replace(/%OBJECT%/g, replacer(coverState));
            return code;
        },

        startIgnore: function () {
            this.currentState.ignoring += 1;
        },

        endIgnore: function () {
            this.currentState.ignoring -= 1;
        },

        convertToBlock: function (node) {
            if (!node) {
                return { type: 'BlockStatement', body: [] };
            } else if (node.type === 'BlockStatement') {
                return node;
            } else {
                return { type: 'BlockStatement', body: [ node ] };
            }
        },

        ifBlockConverter: function (node) {
            node.consequent = this.convertToBlock(node.consequent);
            node.alternate = this.convertToBlock(node.alternate);
        },

        loopBlockConverter: function (node) {
            node.body = this.convertToBlock(node.body);
        },

        withBlockConverter: function (node) {
            node.body = this.convertToBlock(node.body);
        },

        statementName: function (location, initValue) {
            var sName,
                ignoring = !!this.currentState.ignoring;

            location.skip = ignoring || undefined;
            initValue = initValue || 0;
            this.currentState.statement += 1;
            sName = this.currentState.statement;
            this.coverState.statementMap[sName] = location;
            this.coverState.s[sName] = initValue;
            return sName;
        },

        skipInit: function (node /*, walker */) {
            if (node.init) {
                node.init.skipWalk = true;
            }
        },

        skipLeft: function (node /*, walker */) {
            node.left.skipWalk = true;
        },

        isUseStrictExpression: function (node) {
            return node && node.type === SYNTAX.ExpressionStatement.name &&
                node.expression  && node.expression.type === SYNTAX.Literal.name &&
                node.expression.value === 'use strict';
        },

        maybeSkipNode: function (node, type) {
            var alreadyIgnoring = !!this.currentState.ignoring,
                hint = this.currentState.currentHint,
                ignoreThis = !alreadyIgnoring && hint && hint.type === type;

            if (ignoreThis) {
                this.startIgnore();
                node.postprocessor = this.endIgnore;
                return true;
            }
            return false;
        },

        coverStatement: function (node, walker) {
            var sName,
                incrStatementCount,
                grandParent;

            this.maybeSkipNode(node, 'next');

            if (this.isUseStrictExpression(node)) {
                grandParent = walker.ancestor(2);
                /* istanbul ignore else: difficult to test */
                if (grandParent) {
                    if ((grandParent.node.type === SYNTAX.FunctionExpression.name ||
                        grandParent.node.type === SYNTAX.FunctionDeclaration.name)  &&
                        walker.parent().node.body[0] === node) {
                        return;
                    }
                }
            }
            if (node.type === SYNTAX.FunctionDeclaration.name) {
                sName = this.statementName(node.loc, 1);
            } else {
                sName = this.statementName(node.loc);
                incrStatementCount = astgen.statement(
                    astgen.postIncrement(
                        astgen.subscript(
                            astgen.dot(astgen.variable(this.currentState.trackerVar), astgen.variable('s')),
                            astgen.stringLiteral(sName)
                        )
                    )
                );
                this.splice(incrStatementCount, node, walker);
            }
        },

        splice: function (statements, node, walker) {
            var targetNode = walker.isLabeled() ? walker.parent().node : node;
            targetNode.prepend = targetNode.prepend || [];
            pushAll(targetNode.prepend, statements);
        },

        functionName: function (node, line, location) {
            this.currentState.func += 1;
            var id = this.currentState.func,
                ignoring = !!this.currentState.ignoring,
                name = node.id ? node.id.name : '(anonymous_' + id + ')';
            this.coverState.fnMap[id] = { name: name, line: line, loc: location, skip: ignoring || undefined };
            this.coverState.f[id] = 0;
            return id;
        },

        coverFunction: function (node, walker) {
            var id,
                body = node.body,
                blockBody = body.body,
                popped;

            this.maybeSkipNode(node, 'next');

            id = this.functionName(node, walker.startLineForNode(node), {
                start: node.loc.start,
                end: { line: node.body.loc.start.line, column: node.body.loc.start.column }
            });

            if (blockBody.length > 0 && this.isUseStrictExpression(blockBody[0])) {
                popped = blockBody.shift();
            }
            blockBody.unshift(
                astgen.statement(
                    astgen.postIncrement(
                        astgen.subscript(
                            astgen.dot(astgen.variable(this.currentState.trackerVar), astgen.variable('f')),
                            astgen.stringLiteral(id)
                        )
                    )
                )
            );
            if (popped) {
                blockBody.unshift(popped);
            }
        },

        branchName: function (type, startLine, pathLocations) {
            var bName,
                paths = [],
                locations = [],
                i,
                ignoring = !!this.currentState.ignoring;
            this.currentState.branch += 1;
            bName = this.currentState.branch;
            for (i = 0; i < pathLocations.length; i += 1) {
                pathLocations[i].skip = pathLocations[i].skip || ignoring || undefined;
                locations.push(pathLocations[i]);
                paths.push(0);
            }
            this.coverState.b[bName] = paths;
            this.coverState.branchMap[bName] = { line: startLine, type: type, locations: locations };
            return bName;
        },

        branchIncrementExprAst: function (varName, branchIndex, down) {
            var ret = astgen.postIncrement(
                astgen.subscript(
                    astgen.subscript(
                        astgen.dot(astgen.variable(this.currentState.trackerVar), astgen.variable('b')),
                        astgen.stringLiteral(varName)
                    ),
                    astgen.numericLiteral(branchIndex)
                ),
                down
            );
            return ret;
        },

        locationsForNodes: function (nodes) {
            var ret = [],
                i;
            for (i = 0; i < nodes.length; i += 1) {
                ret.push(nodes[i].loc);
            }
            return ret;
        },

        ifBranchInjector: function (node, walker) {
            var alreadyIgnoring = !!this.currentState.ignoring,
                hint = this.currentState.currentHint,
                ignoreThen = !alreadyIgnoring && hint && hint.type === 'if',
                ignoreElse = !alreadyIgnoring && hint && hint.type === 'else',
                line = node.loc.start.line,
                col = node.loc.start.column,
                start = { line: line, column: col },
                end = { line: line, column: col },
                bName = this.branchName('if', walker.startLineForNode(node), [
                    { start: start, end: end, skip: ignoreThen || undefined },
                    { start: start, end: end, skip: ignoreElse || undefined }
                ]),
                thenBody = node.consequent.body,
                elseBody = node.alternate.body,
                child;
            thenBody.unshift(astgen.statement(this.branchIncrementExprAst(bName, 0)));
            elseBody.unshift(astgen.statement(this.branchIncrementExprAst(bName, 1)));
            if (ignoreThen) { child = node.consequent; child.preprocessor = this.startIgnore; child.postprocessor = this.endIgnore; }
            if (ignoreElse) { child = node.alternate; child.preprocessor = this.startIgnore; child.postprocessor = this.endIgnore; }
        },

        branchLocationFor: function (name, index) {
            return this.coverState.branchMap[name].locations[index];
        },

        switchBranchInjector: function (node, walker) {
            var cases = node.cases,
                bName,
                i;

            if (!(cases && cases.length > 0)) {
                return;
            }
            bName = this.branchName('switch', walker.startLineForNode(node), this.locationsForNodes(cases));
            for (i = 0; i < cases.length; i += 1) {
                cases[i].branchLocation = this.branchLocationFor(bName, i);
                cases[i].consequent.unshift(astgen.statement(this.branchIncrementExprAst(bName, i)));
            }
        },

        switchCaseInjector: function (node) {
            var location = node.branchLocation;
            delete node.branchLocation;
            if (this.maybeSkipNode(node, 'next')) {
                location.skip = true;
            }
        },

        conditionalBranchInjector: function (node, walker) {
            var bName = this.branchName('cond-expr', walker.startLineForNode(node), this.locationsForNodes([ node.consequent, node.alternate ])),
                ast1 = this.branchIncrementExprAst(bName, 0),
                ast2 = this.branchIncrementExprAst(bName, 1);

            node.consequent.preprocessor = this.maybeAddSkip(this.branchLocationFor(bName, 0));
            node.alternate.preprocessor = this.maybeAddSkip(this.branchLocationFor(bName, 1));
            node.consequent = astgen.sequence(ast1, node.consequent);
            node.alternate = astgen.sequence(ast2, node.alternate);
        },

        maybeAddSkip: function (branchLocation) {
            return function (node) {
                var alreadyIgnoring = !!this.currentState.ignoring,
                    hint = this.currentState.currentHint,
                    ignoreThis = !alreadyIgnoring && hint && hint.type === 'next';
                if (ignoreThis) {
                    this.startIgnore();
                    node.postprocessor = this.endIgnore;
                }
                if (ignoreThis || alreadyIgnoring) {
                    branchLocation.skip = true;
                }
            };
        },

        logicalExpressionBranchInjector: function (node, walker) {
            var parent = walker.parent(),
                leaves = [],
                bName,
                tuple,
                i;

            this.maybeSkipNode(node, 'next');

            if (parent && parent.node.type === SYNTAX.LogicalExpression.name) {
                //already covered
                return;
            }

            this.findLeaves(node, leaves);
            bName = this.branchName('binary-expr',
                walker.startLineForNode(node),
                this.locationsForNodes(leaves.map(function (item) { return item.node; }))
            );
            for (i = 0; i < leaves.length; i += 1) {
                tuple = leaves[i];
                tuple.parent[tuple.property] = astgen.sequence(this.branchIncrementExprAst(bName, i), tuple.node);
                tuple.node.preprocessor = this.maybeAddSkip(this.branchLocationFor(bName, i));
            }
        },

        findLeaves: function (node, accumulator, parent, property) {
            if (node.type === SYNTAX.LogicalExpression.name) {
                this.findLeaves(node.left, accumulator, node, 'left');
                this.findLeaves(node.right, accumulator, node, 'right');
            } else {
                accumulator.push({ node: node, parent: parent, property: property });
            }
        },
        maybeAddType: function (node /*, walker */) {
            var props = node.properties,
                i,
                child;
            for (i = 0; i < props.length; i += 1) {
                child = props[i];
                if (!child.type) {
                    child.type = SYNTAX.Property.name;
                }
            }
        }
    };

    if (isNode) {
        module.exports = Instrumenter;
    } else {
        self.Instrumenter = Instrumenter;
    }

}(typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof exports !== 'undefined'));

