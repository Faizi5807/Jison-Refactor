#!/usr/bin/env node
"use strict";

const fs = require('fs');
const path = require('path');

// --- Command Pattern Classes for Parsing ---

class ParseJSONCommand {
    constructor(file) {
        this.file = file;
    }

    execute() {
        const cjson = require('cjson');
        return cjson.parse(this.file);
    }
}

class ParseEBNFCommand {
    constructor(file) {
        this.file = file;
    }

    execute() {
        const ebnfParser = require('ebnf-parser');
        return ebnfParser.parse(this.file);
    }
}

class ParseLexCommand {
    constructor(lexSource) {
        this.lexSource = lexSource;
    }

    execute() {
        const lexParser = require('lex-parser');
        return lexParser.parse(this.lexSource);
    }
}

// --- New Class for Handling Input Grammar Sources ---
class GrammarSource {
    static fromFile(filePath, lexPath) {
        const raw = fs.readFileSync(path.normalize(filePath), 'utf8');
        const lex = lexPath ? fs.readFileSync(path.normalize(lexPath), 'utf8') : null;
        return { raw, lex };
    }

    static fromStdin(callback) {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => callback(data));
    }
}

// --- Command-Line Option Parser ---
function getCommandlineOptions() {
    const version = require('../package.json').version;
    return require("nomnom")
        .script('jison')
        .option('file', {
            flag: true,
            position: 0,
            help: 'file containing a grammar'
        })
        .option('lexfile', {
            flag: true,
            position: 1,
            help: 'file containing a lexical grammar'
        })
        .option('json', {
            abbr: 'j',
            flag: true,
            help: 'force jison to expect a grammar in JSON format'
        })
        .option('outfile', {
            abbr: 'o',
            metavar: 'FILE',
            help: 'Filename and base module name of the generated parser'
        })
        .option('debug', {
            abbr: 't',
            flag: true,
            default: false,
            help: 'Debug mode'
        })
        .option('module-type', {
            abbr: 'm',
            default: 'commonjs',
            metavar: 'TYPE',
            help: 'The type of module to generate (commonjs, amd, js)'
        })
        .option('parser-type', {
            abbr: 'p',
            default: 'lalr',
            metavar: 'TYPE',
            help: 'The type of algorithm to use for the parser (lr0, slr, lalr, lr)'
        })
        .option('version', {
            abbr: 'V',
            flag: true,
            help: 'print version and exit',
            callback: () => version
        }).parse();
}

// --- Helpers ---
function isJSONMode(filepath, forceFlag) {
    return path.extname(filepath) === '.json' || forceFlag;
}

function getModuleName(filePathOrOutfile) {
    return path.basename(filePathOrOutfile).replace(/\..*$/, '');
}

function writeParserFile(filename, parserCode) {
    fs.writeFileSync(filename, parserCode);
}

// --- CLI Logic ---
const cli = module.exports;

cli.main = function (opts) {
    opts = opts || {};

    function processGrammar(raw, lex, opts) {
        let parserCommand = opts.json
            ? new ParseJSONCommand(raw)
            : new ParseEBNFCommand(raw);

        let grammar = parserCommand.execute();

        if (lex) {
            grammar.lex = new ParseLexCommand(lex).execute();
        }

        return cli.generateParserString(opts, grammar);
    }

    if (opts.file) {
        const { raw, lex } = GrammarSource.fromFile(opts.file, opts.lexfile);
        opts.json = isJSONMode(opts.file, opts.json);

        const baseName = getModuleName(opts.outfile || opts.file);
        opts.outfile = opts.outfile || `${baseName}.js`;

        if (!opts.moduleName) {
            opts.moduleName = baseName.replace(/-\w/g, match => match.charAt(1).toUpperCase());
        }

        const parserCode = processGrammar(raw, lex, opts);
        writeParserFile(opts.outfile, parserCode);
    } else {
        GrammarSource.fromStdin(data => {
            const parserCode = processGrammar(data, null, opts);
            console.log(parserCode);
        });
    }
};

cli.generateParserString = function (opts, grammar) {
    opts = opts || {};
    const jison = require('./jison.js');
    const settings = grammar.options || {};

    if (opts['parser-type']) {
        settings.type = opts['parser-type'];
    }
    if (opts.moduleName) {
        settings.moduleName = opts.moduleName;
    }
    settings.debug = opts.debug;

    if (!settings.moduleType) {
        settings.moduleType = opts['module-type'];
    }

    const generator = new jison.Generator(grammar, settings);
    return generator.generate(settings);
};

if (require.main === module) {
    const opts = getCommandlineOptions();
    cli.main(opts);
}
