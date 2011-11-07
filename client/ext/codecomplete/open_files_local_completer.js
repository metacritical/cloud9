define(function(require, exports, module) {

var completeUtil = require("ext/codecomplete/complete_util");

var oop = require("pilot/oop");
var BaseLanguageHandler = require('ext/language/base_handler').BaseLanguageHandler;

var ID_REGEX = /[a-zA-Z_0-9\$]/;

var analysisCache = {}; // path => {identifier: 3, ...}
var globalWordIndex = {}; // word => frequency
var globalWordFiles = {}; // word => [path]

var Completer = exports.Completer = function(sender) {

};

oop.inherits(Completer, BaseLanguageHandler);

(function() {
    
    this.handlesPath = function(path) {
        return true;
    };

    function frequencyAnalyzer(path, text, identDict, fileDict) {
        var identifiers = text.split(/[^a-zA-Z_0-9\$]+/);
        for (var i = 0; i < identifiers.length; i++) {
            var ident = identifiers[i];
            if(!ident)
                continue;
                
            if (Object.prototype.hasOwnProperty.call(identDict, ident)) {
                identDict[ident]++;
                fileDict[ident][path] = true;
            }
            else {
                identDict[ident] = 1;
                fileDict[ident] = {};
                fileDict[ident][path] = true;
            }
        }
        return identDict;
    }
    
    function removeDocumentFromCache(path) {
        var analysis = analysisCache[path];
        if(!analysis) return;
    
        for (var id in analysis) {
            globalWordIndex[id] -= analysis[id];
            delete globalWordFiles[id][path];
            if (globalWordIndex[id] === 0) {
                delete globalWordIndex[id];
                delete globalWordFiles[id];
            }
        }
        delete analysisCache[path];
    }
    
    function analyzeDocument(path, allCode) {
        if(!analysisCache[path]) {
            // Delay this slightly, because in Firefox document.value is not immediately filled
            analysisCache[path] = frequencyAnalyzer(path, allCode, {}, {});
            // may be a bit redundant to do this twice, but alright...
            frequencyAnalyzer(path, allCode, globalWordIndex, globalWordFiles);
        }
    }

    this.onDocumentOpen = function(path, doc) {
        if(!analysisCache[path]) {
            analyzeDocument(path, doc.getValue());
        }
    };
    
    this.onDocumentClose = function(path) {
        removeDocumentFromCache(path);
    };
    
    this.onUpdate = function(doc) {
        removeDocumentFromCache(this.path);
        analyzeDocument(this.path, doc.getValue());
    };
    
    this.complete = function(doc, fullAst, pos, currentNode) {
        var line = doc.getLine(pos.row);
        var identifier = completeUtil.retrievePreceedingIdentifier(line, pos.column);
        var identDict = globalWordIndex;
        
        var allIdentifiers = [];
        for(var ident in identDict) {
            allIdentifiers.push(ident);
        }
        var matches = completeUtil.findCompletions(identifier, allIdentifiers);
        
        var currentPath = this.path;
        matches = matches.filter(function(m) {
            return !globalWordFiles[m][currentPath];
        });
    
        return matches.map(function(m) {
            var path = Object.keys(globalWordFiles[m])[0] || "[unknown]";
            var pathParts = path.split("/");
            var foundInFile = pathParts[pathParts.length-1];
            return {
              name        : m,
              replaceText : m,
              icon        : null,
              score       : identDict[m],
              meta        : foundInFile,
              priority    : 0
            };
        });
    };
}).call(Completer.prototype);

});