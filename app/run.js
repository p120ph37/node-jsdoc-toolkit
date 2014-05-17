#!/usr/bin/env node
/**
 * @fileOverview
 * A bootstrap script that creates some basic required objects
 * for loading other scripts.  This variant provides the glue
 * to run on top of Node.js rather than Java+Rhino.
 * @author Aaron Wirtz, me@awirtz.com
 */

// load the node.js libraries to be abstracted
var fs = require('fs');
var path = require('path');
var Script = require('vm').Script;

// default template directory.
process.env.JSDOCTEMPLATEDIR = path.resolve(__dirname, '../templates/jsdoc/');

// define a few globals to be compatible with jsrun.jar
global.arguments = global.internal_args || process.argv.slice(2);
load = function(file) {
	Script.runInThisContext(fs.readFileSync(file), file);
};
print = console.log;
quit = process.exit;

/**
 * @namespace Keep track of any messages from the running script.
 */
LOG = {
	warn: function(msg, e) {
		if (JSDOC.opt.q) return;
		if (e) msg = e.fileName+", line "+e.lineNumber+": "+msg;

		msg = ">> WARNING: "+msg;
		LOG.warnings.push(msg);
		if (LOG.out) LOG.out.write(msg+"\n");
		else print(msg);
	},

	inform: function(msg) {
		if (JSDOC.opt.q) return;
		msg = " > "+msg;
		if (LOG.out) LOG.out.write(msg+"\n");
		else if (typeof LOG.verbose != "undefined" && LOG.verbose) print(msg);
	}
};
LOG.warnings = [];
LOG.verbose = false;
LOG.out = undefined;

/**
 *	@class Manipulate a filepath.
 */
FilePath = function(absPath, separator) {
	this.slash =  separator || "/";
	this.root = this.slash;
	this.path = [];
	this.file = "";

	var parts = absPath.split(/[\\\/]/);
	if (parts) {
		if (parts.length) this.root = parts.shift() + this.slash;
		if (parts.length) this.file = parts.pop();
		if (parts.length) this.path = parts;
	}

	this.path = this.resolvePath();
}

/** Collapse any dot-dot or dot items in a filepath. */
FilePath.prototype.resolvePath = function() {
	var resolvedPath = [];
	for (var i = 0; i < this.path.length; i++) {
		if (this.path[i] == "..") resolvedPath.pop();
		else if (this.path[i] != ".") resolvedPath.push(this.path[i]);
	}
	return resolvedPath;
}

/** Trim off the filename. */
FilePath.prototype.toDir = function() {
	if (this.file) this.file = "";
	return this;
}

/** Go up a directory. */
FilePath.prototype.upDir = function() {
	this.toDir();
	if (this.path.length) this.path.pop();
	return this;
}

FilePath.prototype.toString = function() {
	return this.root
		+ this.path.join(this.slash)
		+ ((this.path.length > 0)? this.slash : "")
		+ this.file;
}

/**
 * Turn a path into just the name of the file.
 */
FilePath.fileName = function(path) {
	var nameStart = Math.max(path.lastIndexOf("/")+1, path.lastIndexOf("\\")+1, 0);
	return path.substring(nameStart);
}

/**
 * Get the extension of a filename
 */
FilePath.fileExtension = function(filename) {
   return filename.split(".").pop().toLowerCase();
};

/**
 * Turn a path into just the directory part.
 */
FilePath.dir = function(path) {
	var nameStart = Math.max(path.lastIndexOf("/")+1, path.lastIndexOf("\\")+1, 0);
	return path.substring(0, nameStart-1);
}


/**
 * @namespace A collection of information about your system.
 */
SYS = {}
/**
 * Which way does your slash lean.
 * @type string
 */
SYS.slash = "/";
/**
 * The absolute path to the directory containing this script.
 * @type string
 */
SYS.pwd = __dirname+SYS.slash;

/**
 * Shims java.io.FileWriter
 * @class Shims java.io.FileWriter
 * @author <a href="mailto:matthewkastor@gmail.com">Matthew Kastor</a>
 */
FileWriter = function () {
    this.lock = undefined;
    this.writeStream = undefined;
};
/**
 * Opens a file for writing only.
 * @param {String} path The path to the file to write.
 * @param {Boolean} [append = true] If set to false the file will be overwritten.
 * @returns {FileWriter} returns a new FileWriter instance whose writeStream is
 *  set to the file at the given path.
 * @see <a href="http://nodejs.org/api/fs.html#fs_class_fs_writestream">
 *  fs.WriteStream</a>
 */
FileWriter.prototype.open = function(/**string*/ path, /**boolean*/ append) {
    if(append == null) append = true;
    this.writeStream = fs.createWriteStream(path, {flags: (append ? "a" : "w")});
    return this;
};
/**
 * Closes the write stream.
 */
FileWriter.prototype.close = function () {
    this.writeStream.end();
};
/**
 * No op. The data is flushed when close is called.
 */
FileWriter.prototype.flush = function () {
    // no op, data is flushed when the writeStream's end
    // method is called.
};
/**
 * Write stream is created with default encoding (utf8). If the open method is
 *  changed to allow specifying an encoding then it will need to be tracked and
 *  returned by this method.
 * @returns "utf8"
 */
FileWriter.prototype.getEncoding = function () {
    return "utf8";
};
/**
 * Appends a substring of the given string to the file.
 * @param {String} str The string to write.
 * @param {Number} [from = 0] The beginning of the substring of str.
 * @param {Number} [to = str.length] The end of the substring of str.
 */
FileWriter.prototype.append = function (str, from, to) {
    from = from || 0;
    to = to || str.length;
    str = str.substr(from, to);
    this.write(str, 'utf8');
};
/**
 * Writes the given data to the file.
 * @param {String} str The string to write.
 */
FileWriter.prototype.write = function (str) {
    this.writeStream.write(str, 'utf8');
};
/**
 * @namespace A collection of functions that deal with reading a writing to disk.
 */
IO = {

	/**
	 * Create a new file in the given directory, with the given name and contents.
	 */
	saveFile: function(/**string*/ outDir, /**string*/ fileName, /**string*/ content) {
		fs.writeFileSync(outDir + "/" + fileName, content, IO.encoding);
	},

	/**
	 * @type string
	 */
	readFile: function(/**string*/ path) {
		return fs.readFileSync(path, IO.encoding);
	},

	/**
	 * @param inFile
	 * @param outDir
	 * @param [fileName=The original filename]
	 */
	copyFile: function(/**string*/ inFile, /**string*/ outDir, /**string*/ fileName) {
		if (fileName == null) fileName = FilePath.fileName(inFile);
		inFile = path.normalize(inFile);
		outFile = path.normalize(outDir + "/" + fileName);
		if (!fs.existsSync(inFile)) {
			// Could not find file to copy, ignoring: ' + inFile
			// Should we log or safe to ignore?
			return;
		};
		fs.createReadStream(inFile).pipe(fs.createWriteStream(outFile));
	},

	/**
	 * Creates a series of nested directories.
	 */
	mkPath: function(/**Array*/ path) {
		if (path.constructor != Array) path = path.split(/[\\\/]/);
		var make = "";
		for (var i = 0, l = path.length; i < l; i++) {
			make += path[i] + SYS.slash;
			if (! IO.exists(make)) {
				IO.makeDir(make);
			}
		}
	},

	/**
	 * Creates a directory at the given path.
	 */
	makeDir: function(/**string*/ path) {
		fs.mkdirSync(path, 0777);
	},

	/**
	 * @type string[]
	 * @param dir The starting directory to look in.
	 * @param [recurse=1] How many levels deep to scan.
	 * @returns An array of all the paths to files in the given dir.
	 */
	ls: function(/**string*/ dir, /**number*/ recurse, _allFiles, _path) {
		if (_path === undefined) { // initially
			var _allFiles = [];
			var _path = [dir];
		}
		if (_path.length == 0) return _allFiles;
		if (recurse === undefined) recurse = 1;

		var s = fs.statSync(dir);
		if (!s.isDirectory()) return [dir];
		var files = fs.readdirSync(dir);

		for (var f = 0; f < files.length; f++) {
			var file = files[f];
			if (file.match(/^\.[^\.\/\\]/)) continue; // skip dot files

			if ((fs.statSync(_path.join("/")+"/"+file).isDirectory())) { // it's a directory
				_path.push(file);
				if (_path.length-1 < recurse) IO.ls(_path.join("/"), recurse, _allFiles, _path);
				_path.pop();
			}
			else {
				_allFiles.push((_path.join("/")+"/"+file).replace("//", "/"));
			}
		}

		return _allFiles;
	},

	/**
	 * @type boolean
	 */
	exists: function(/**string*/ path) {
		try {
			fs.statSync(path);
			return true;
		} catch(e) {
			return false;
		}
	},

	/**
	 * Opens a file for writing
	 */
	open: function(/**string*/ path, /**boolean*/ append) {
		var file = new FileWriter();
        return file.open(path, append);
	},

	/**
	 * Sets {@link IO.encoding}.
	 * Encoding is used when reading and writing text to files,
	 * and in the meta tags of HTML output.
	 */
	setEncoding: function(/**string*/ encoding) {
		if (/UTF-8/i.test(encoding)) {
			IO.encoding = "utf8";
		}
		else if (/ASCII/i.test(encoding)) {
			IO.encoding = "ascii";
		}
		else {
			throw("Unsupported encoding: "+encoding+" - perhaps you can use UTF-8?");
		}
	},

	/**
	 * @default "utf8"
	 * @private
	 */
	encoding: "utf8",

	/**
	 * Load the given script.
	 */
	include: function(relativePath) {
		load(SYS.pwd+relativePath);
	},

	/**
	 * Loads all scripts from the given directory path.
	 */
	includeDir: function(path) {
		if (!path) return;
		for (var lib = IO.ls(SYS.pwd+path), i = 0; i < lib.length; i++)
			if (/\.js$/i.test(lib[i])) load(lib[i]);
	}
}

// now run the application
IO.include("frame.js");
IO.include("main.js");

main();
