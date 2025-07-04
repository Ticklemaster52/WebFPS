var Module = typeof Module !== "undefined" ? Module : {};

var moduleOverrides = {};

var key;

for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}

Module["arguments"] = [];

Module["thisProgram"] = "./this.program";

Module["quit"] = function(status, toThrow) {
 throw toThrow;
};

Module["preRun"] = [];

Module["postRun"] = [];

var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = false;

var ENVIRONMENT_IS_NODE = false;

var ENVIRONMENT_IS_SHELL = false;

ENVIRONMENT_IS_WEB = typeof window === "object";

ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;

ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module["ENVIRONMENT"]) {
 throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)");
}

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 } else {
  return scriptDirectory + path;
 }
}

if (ENVIRONMENT_IS_NODE) {
 scriptDirectory = __dirname + "/";
 var nodeFS;
 var nodePath;
 Module["read"] = function shell_read(filename, binary) {
  var ret;
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  ret = nodeFS["readFileSync"](filename);
  return binary ? ret : ret.toString();
 };
 Module["readBinary"] = function readBinary(filename) {
  var ret = Module["read"](filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
 }
 Module["arguments"] = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", abort);
 Module["quit"] = function(status) {
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  Module["read"] = function shell_read(f) {
   return read(f);
  };
 }
 Module["readBinary"] = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  Module["arguments"] = scriptArgs;
 } else if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
 if (typeof quit === "function") {
  Module["quit"] = function(status) {
   quit(status);
  };
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 Module["read"] = function shell_read(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (ENVIRONMENT_IS_WORKER) {
  Module["readBinary"] = function readBinary(url) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.responseType = "arraybuffer";
   xhr.send(null);
   return new Uint8Array(xhr.response);
  };
 }
 Module["readAsync"] = function readAsync(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
    return;
   }
   onerror();
  };
  xhr.onerror = onerror;
  xhr.send(null);
 };
 Module["setWindowTitle"] = function(title) {
  document.title = title;
 };
} else {
 throw new Error("environment detection error");
}

var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);

var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = undefined;

assert(typeof Module["memoryInitializerPrefixURL"] === "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["pthreadMainPrefixURL"] === "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["cdInitializerPrefixURL"] === "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["filePackagePrefixURL"] === "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");

var STACK_ALIGN = 16;

stackSave = stackRestore = stackAlloc = function() {
 abort("cannot use the stack before compiled code is ready to run, and has provided stack access");
};

function dynamicAlloc(size) {
 assert(DYNAMICTOP_PTR);
 var ret = HEAP32[DYNAMICTOP_PTR >> 2];
 var end = ret + size + 15 & -16;
 if (end <= _emscripten_get_heap_size()) {
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
 } else {
  var success = _emscripten_resize_heap(end);
  if (!success) return 0;
 }
 return ret;
}

function getNativeTypeSize(type) {
 switch (type) {
 case "i1":
 case "i8":
  return 1;

 case "i16":
  return 2;

 case "i32":
  return 4;

 case "i64":
  return 8;

 case "float":
  return 4;

 case "double":
  return 8;

 default:
  {
   if (type[type.length - 1] === "*") {
    return 4;
   } else if (type[0] === "i") {
    var bits = parseInt(type.substr(1));
    assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
    return bits / 8;
   } else {
    return 0;
   }
  }
 }
}

function warnOnce(text) {
 if (!warnOnce.shown) warnOnce.shown = {};
 if (!warnOnce.shown[text]) {
  warnOnce.shown[text] = 1;
  err(text);
 }
}

var asm2wasmImports = {
 "f64-rem": function(x, y) {
  return x % y;
 },
 "debugger": function() {
  debugger;
 }
};

var jsCallStartIndex = 1;

var functionPointers = new Array(0);

function convertJsFunctionToWasm(func, sig) {
 var typeSection = [ 1, 0, 1, 96 ];
 var sigRet = sig.slice(0, 1);
 var sigParam = sig.slice(1);
 var typeCodes = {
  "i": 127,
  "j": 126,
  "f": 125,
  "d": 124
 };
 typeSection.push(sigParam.length);
 for (var i = 0; i < sigParam.length; ++i) {
  typeSection.push(typeCodes[sigParam[i]]);
 }
 if (sigRet == "v") {
  typeSection.push(0);
 } else {
  typeSection = typeSection.concat([ 1, typeCodes[sigRet] ]);
 }
 typeSection[1] = typeSection.length - 2;
 var bytes = new Uint8Array([ 0, 97, 115, 109, 1, 0, 0, 0 ].concat(typeSection, [ 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0 ]));
 var module = new WebAssembly.Module(bytes);
 var instance = new WebAssembly.Instance(module, {
  e: {
   f: func
  }
 });
 var wrappedFunc = instance.exports.f;
 return wrappedFunc;
}

var funcWrappers = {};

var printObjectList = [];

function makeBigInt(low, high, unsigned) {
 return unsigned ? +(low >>> 0) + +(high >>> 0) * 4294967296 : +(low >>> 0) + +(high | 0) * 4294967296;
}

function dynCall(sig, ptr, args) {
 if (args && args.length) {
  assert(args.length == sig.length - 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
  return Module["dynCall_" + sig].apply(null, [ ptr ].concat(args));
 } else {
  assert(sig.length == 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
  return Module["dynCall_" + sig].call(null, ptr);
 }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
 tempRet0 = value;
};

var getTempRet0 = function() {
 return tempRet0;
};

if (typeof WebAssembly !== "object") {
 abort("No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.");
}

var wasmMemory;

var wasmTable;

var ABORT = false;

var EXITSTATUS = 0;

function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}

function getCFunc(ident) {
 var func = Module["_" + ident];
 assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
 return func;
}

function ccall(ident, returnType, argTypes, args, opts) {
 var toC = {
  "string": function(str) {
   var ret = 0;
   if (str !== null && str !== undefined && str !== 0) {
    var len = (str.length << 2) + 1;
    ret = stackAlloc(len);
    stringToUTF8(str, ret, len);
   }
   return ret;
  },
  "array": function(arr) {
   var ret = stackAlloc(arr.length);
   writeArrayToMemory(arr, ret);
   return ret;
  }
 };
 function convertReturnValue(ret) {
  if (returnType === "string") return UTF8ToString(ret);
  if (returnType === "boolean") return Boolean(ret);
  return ret;
 }
 var func = getCFunc(ident);
 var cArgs = [];
 var stack = 0;
 assert(returnType !== "array", 'Return type should not be "array".');
 if (args) {
  for (var i = 0; i < args.length; i++) {
   var converter = toC[argTypes[i]];
   if (converter) {
    if (stack === 0) stack = stackSave();
    cArgs[i] = converter(args[i]);
   } else {
    cArgs[i] = args[i];
   }
  }
 }
 var ret = func.apply(null, cArgs);
 ret = convertReturnValue(ret);
 if (stack !== 0) stackRestore(stack);
 return ret;
}

function setValue(ptr, value, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  HEAP8[ptr >> 0] = value;
  break;

 case "i8":
  HEAP8[ptr >> 0] = value;
  break;

 case "i16":
  HEAP16[ptr >> 1] = value;
  break;

 case "i32":
  HEAP32[ptr >> 2] = value;
  break;

 case "i64":
  tempI64 = [ value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
  break;

 case "float":
  HEAPF32[ptr >> 2] = value;
  break;

 case "double":
  HEAPF64[ptr >> 3] = value;
  break;

 default:
  abort("invalid type for setValue: " + type);
 }
}

var ALLOC_NORMAL = 0;

var ALLOC_STACK = 1;

var ALLOC_NONE = 3;

function allocate(slab, types, allocator, ptr) {
 var zeroinit, size;
 if (typeof slab === "number") {
  zeroinit = true;
  size = slab;
 } else {
  zeroinit = false;
  size = slab.length;
 }
 var singleType = typeof types === "string" ? types : null;
 var ret;
 if (allocator == ALLOC_NONE) {
  ret = ptr;
 } else {
  ret = [ _malloc, stackAlloc, dynamicAlloc ][allocator](Math.max(size, singleType ? 1 : types.length));
 }
 if (zeroinit) {
  var stop;
  ptr = ret;
  assert((ret & 3) == 0);
  stop = ret + (size & ~3);
  for (;ptr < stop; ptr += 4) {
   HEAP32[ptr >> 2] = 0;
  }
  stop = ret + size;
  while (ptr < stop) {
   HEAP8[ptr++ >> 0] = 0;
  }
  return ret;
 }
 if (singleType === "i8") {
  if (slab.subarray || slab.slice) {
   HEAPU8.set(slab, ret);
  } else {
   HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
 }
 var i = 0, type, typeSize, previousType;
 while (i < size) {
  var curr = slab[i];
  type = singleType || types[i];
  if (type === 0) {
   i++;
   continue;
  }
  assert(type, "Must know what type to store in allocate!");
  if (type == "i64") type = "i32";
  setValue(ret + i, curr, type);
  if (previousType !== type) {
   typeSize = getNativeTypeSize(type);
   previousType = type;
  }
  i += typeSize;
 }
 return ret;
}

function getMemory(size) {
 if (!runtimeInitialized) return dynamicAlloc(size);
 return _malloc(size);
}

function Pointer_stringify(ptr, length) {
 abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!");
}

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
 } else {
  var str = "";
  while (idx < endPtr) {
   var u0 = u8Array[idx++];
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   var u1 = u8Array[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   var u2 = u8Array[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!");
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) {
   var u1 = str.charCodeAt(++i);
   u = 65536 + ((u & 1023) << 10) | u1 & 1023;
  }
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   outU8Array[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   outU8Array[outIdx++] = 192 | u >> 6;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   outU8Array[outIdx++] = 224 | u >> 12;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 3 >= endIdx) break;
   if (u >= 2097152) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).");
   outU8Array[outIdx++] = 240 | u >> 18;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  }
 }
 outU8Array[outIdx] = 0;
 return outIdx - startIdx;
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
 assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}

function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4;
 }
 return len;
}

var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function allocateUTF8(str) {
 var size = lengthBytesUTF8(str) + 1;
 var ret = _malloc(size);
 if (ret) stringToUTF8Array(str, HEAP8, ret, size);
 return ret;
}

function allocateUTF8OnStack(str) {
 var size = lengthBytesUTF8(str) + 1;
 var ret = stackAlloc(size);
 stringToUTF8Array(str, HEAP8, ret, size);
 return ret;
}

function writeArrayToMemory(array, buffer) {
 assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
 HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  assert(str.charCodeAt(i) === str.charCodeAt(i) & 255);
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}

function demangle(func) {
 var __cxa_demangle_func = Module["___cxa_demangle"] || Module["__cxa_demangle"];
 assert(__cxa_demangle_func);
 try {
  var s = func;
  if (s.startsWith("__Z")) s = s.substr(1);
  var len = lengthBytesUTF8(s) + 1;
  var buf = _malloc(len);
  stringToUTF8(s, buf, len);
  var status = _malloc(4);
  var ret = __cxa_demangle_func(buf, 0, 0, status);
  if (HEAP32[status >> 2] === 0 && ret) {
   return UTF8ToString(ret);
  }
 } catch (e) {} finally {
  if (buf) _free(buf);
  if (status) _free(status);
  if (ret) _free(ret);
 }
 return func;
}

function demangleAll(text) {
 var regex = /__Z[\w\d_]+/g;
 return text.replace(regex, function(x) {
  var y = demangle(x);
  return x === y ? x : y + " [" + x + "]";
 });
}

function jsStackTrace() {
 var err = new Error();
 if (!err.stack) {
  try {
   throw new Error(0);
  } catch (e) {
   err = e;
  }
  if (!err.stack) {
   return "(no stack trace available)";
  }
 }
 return err.stack.toString();
}

function stackTrace() {
 var js = jsStackTrace();
 if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
 return demangleAll(js);
}

var PAGE_SIZE = 16384;

var WASM_PAGE_SIZE = 65536;

function alignUp(x, multiple) {
 if (x % multiple > 0) {
  x += multiple - x % multiple;
 }
 return x;
}

var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferViews() {
 Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
 Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
 Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}

var STACK_BASE = 16109392, STACK_MAX = 21352272, DYNAMIC_BASE = 21352272, DYNAMICTOP_PTR = 16109360;

assert(STACK_BASE % 16 === 0, "stack must start aligned");

assert(DYNAMIC_BASE % 16 === 0, "heap must start aligned");

var TOTAL_STACK = 5242880;

if (Module["TOTAL_STACK"]) assert(TOTAL_STACK === Module["TOTAL_STACK"], "the stack size can no longer be determined at runtime");

var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 33554432;

if (INITIAL_TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + INITIAL_TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");

assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined, "JS engine does not provide full typed array support");

if (Module["buffer"]) {
 buffer = Module["buffer"];
 assert(buffer.byteLength === INITIAL_TOTAL_MEMORY, "provided buffer should be " + INITIAL_TOTAL_MEMORY + " bytes, but it is " + buffer.byteLength);
} else {
 if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
  assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
  wasmMemory = new WebAssembly.Memory({
   "initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
  });
  buffer = wasmMemory.buffer;
 } else {
  buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY);
 }
 assert(buffer.byteLength === INITIAL_TOTAL_MEMORY);
}

updateGlobalBufferViews();

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function writeStackCookie() {
 assert((STACK_MAX & 3) == 0);
 HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
 HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022;
}

function checkStackCookie() {
 if (HEAPU32[(STACK_MAX >> 2) - 1] != 34821223 || HEAPU32[(STACK_MAX >> 2) - 2] != 2310721022) {
  abort("Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x" + HEAPU32[(STACK_MAX >> 2) - 2].toString(16) + " " + HEAPU32[(STACK_MAX >> 2) - 1].toString(16));
 }
 if (HEAP32[0] !== 1668509029) throw "Runtime error: The application has corrupted its heap memory area (address zero)!";
}

function abortStackOverflow(allocSize) {
 abort("Stack overflow! Attempted to allocate " + allocSize + " bytes on the stack, but stack has only " + (STACK_MAX - stackSave() + allocSize) + " bytes available!");
}

HEAP32[0] = 1668509029;

HEAP16[1] = 25459;

if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Module["dynCall_v"](func);
   } else {
    Module["dynCall_vi"](func, callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATEXIT__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

var runtimeExited = false;

function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
 checkStackCookie();
 if (runtimeInitialized) return;
 runtimeInitialized = true;
 if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
 TTY.init();
 SOCKFS.root = FS.mount(SOCKFS, {}, null);
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 checkStackCookie();
 FS.ignorePermissions = false;
 callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
 checkStackCookie();
 runtimeExited = true;
}

function postRun() {
 checkStackCookie();
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}

function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
 if (value >= 0) {
  return value;
 }
 return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value;
}

function reSign(value, bits, ignore) {
 if (value <= 0) {
  return value;
 }
 var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
 if (value >= half && (bits <= 32 || value > half)) {
  value = -2 * half + value;
 }
 return value;
}

assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

var Math_abs = Math.abs;

var Math_ceil = Math.ceil;

var Math_floor = Math.floor;

var Math_min = Math.min;

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

var runDependencyTracking = {};

function getUniqueRunDependency(id) {
 var orig = id;
 while (1) {
  if (!runDependencyTracking[id]) return id;
  id = orig + Math.random();
 }
 return id;
}

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(!runDependencyTracking[id]);
  runDependencyTracking[id] = 1;
  if (runDependencyWatcher === null && typeof setInterval !== "undefined") {
   runDependencyWatcher = setInterval(function() {
    if (ABORT) {
     clearInterval(runDependencyWatcher);
     runDependencyWatcher = null;
     return;
    }
    var shown = false;
    for (var dep in runDependencyTracking) {
     if (!shown) {
      shown = true;
      err("still waiting on run dependencies:");
     }
     err("dependency: " + dep);
    }
    if (shown) {
     err("(end of list)");
    }
   }, 1e4);
  }
 } else {
  err("warning: run dependency added without ID");
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(runDependencyTracking[id]);
  delete runDependencyTracking[id];
 } else {
  err("warning: run dependency removed without ID");
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}

Module["preloadedImages"] = {};

Module["preloadedAudios"] = {};

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
}

var wasmBinaryFile = "MobileTest.wasm";

if (!isDataURI(wasmBinaryFile)) {
 wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
 try {
  if (Module["wasmBinary"]) {
   return new Uint8Array(Module["wasmBinary"]);
  }
  if (Module["readBinary"]) {
   return Module["readBinary"](wasmBinaryFile);
  } else {
   throw "both async and sync fetching of the wasm failed";
  }
 } catch (err) {
  abort(err);
 }
}

function getBinaryPromise() {
 if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
  return fetch(wasmBinaryFile, {
   credentials: "same-origin"
  }).then(function(response) {
   if (!response["ok"]) {
    throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
   }
   return response["arrayBuffer"]();
  }).catch(function() {
   return getBinary();
  });
 }
 return new Promise(function(resolve, reject) {
  resolve(getBinary());
 });
}

function createWasm(env) {
 var info = {
  "env": env,
  "global": {
   "NaN": NaN,
   Infinity: Infinity
  },
  "global.Math": Math,
  "asm2wasm": asm2wasmImports
 };
 function receiveInstance(instance, module) {
  var exports = instance.exports;
  Module["asm"] = exports;
  removeRunDependency("wasm-instantiate");
 }
 addRunDependency("wasm-instantiate");
 if (Module["instantiateWasm"]) {
  try {
   return Module["instantiateWasm"](info, receiveInstance);
  } catch (e) {
   err("Module.instantiateWasm callback failed with error: " + e);
   return false;
  }
 }
 var trueModule = Module;
 function receiveInstantiatedSource(output) {
  assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
  trueModule = null;
  receiveInstance(output["instance"]);
 }
 function instantiateArrayBuffer(receiver) {
  getBinaryPromise().then(function(binary) {
   return WebAssembly.instantiate(binary, info);
  }).then(receiver, function(reason) {
   err("failed to asynchronously prepare wasm: " + reason);
   abort(reason);
  });
 }
 if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
  WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
   credentials: "same-origin"
  }), info).then(receiveInstantiatedSource, function(reason) {
   err("wasm streaming compile failed: " + reason);
   err("falling back to ArrayBuffer instantiation");
   instantiateArrayBuffer(receiveInstantiatedSource);
  });
 } else {
  instantiateArrayBuffer(receiveInstantiatedSource);
 }
 return {};
}

Module["asm"] = function(global, env, providedBuffer) {
 env["memory"] = wasmMemory;
 env["table"] = wasmTable = new WebAssembly.Table({
  "initial": 270028,
  "maximum": 270028,
  "element": "anyfunc"
 });
 env["__memory_base"] = 1024;
 env["__table_base"] = 0;
 var exports = createWasm(env);
 assert(exports, "binaryen setup failed (no wasm support?)");
 return exports;
};

var ASM_CONSTS = [ function() {
 var callstack = new Error();
 throw callstack.stack;
}, function($0, $1, $2) {
 var InMsg = UTF8ToString($0);
 var InFile = UTF8ToString($1);
 alert("Expression (" + InMsg + ") failed in " + InFile + ":" + $2 + "!\nCheck console for details.\n");
 var callstack = new Error();
 throw callstack.stack;
}, function() {
 throw "SimulateInfiniteLoop";
}, function() {
 console.log("FHTML5SaveGameSystem::Shutdown");
}, function() {
 console.log("FHTML5SaveGameSystem::Initialize");
}, function() {
 if (Module["UE4_resizeCanvas"]) return Module["UE4_resizeCanvas"](true);
 return false;
}, function() {
 return Module["UE4_fullscreenScaleMode"];
}, function() {
 return Module["UE4_fullscreenCanvasResizeMode"];
}, function() {
 return Module["UE4_fullscreenFilteringMode"];
}, function() {
 return Module["UE4_useSoftFullscreenMode"];
}, function() {
 Module["canvas"].focus();
}, function() {
 return document.activeElement === document.body || document.activeElement === Module["canvas"];
}, function($0, $1, $2, $3, $4) {
 if (Module["UE4_keyEvent"]) {
  return Module["UE4_keyEvent"]($0, UTF8ToString($1), $2, $3, $4);
 }
}, function($0, $1, $2, $3, $4, $5) {
 if (Module["UE4_mouseEvent"]) {
  return Module["UE4_mouseEvent"]($0, $1, $2, $3, $4, $5);
 }
}, function($0, $1, $2, $3, $4, $5, $6, $7) {
 if (Module["UE4_wheelEvent"]) {
  return Module["UE4_wheelEvent"]($0, $1, $2, $3, $4, $5, $6, $7);
 }
}, function($0, $1, $2, $3, $4) {
 console.log("FHTML5HttpRequest::StartRequest()" + $0);
 console.log("- URL='" + $1 + "'");
 console.log("- Verb='" + $2 + "'");
 console.log("- Custom headers are " + $3);
 console.log("- Payload size=" + $4);
}, function() {
 console.log("!!! PlatformReleaseOpenGLContext 00");
}, function() {
 console.log("XXX XXX PlatformFlushIfNeeded -- PlatformFlushIfNeeded -- PlatformFlushIfNeeded ");
}, function($0) {
 console.log("kai PlatformRenderingContextSetup: UseRenderThread ->", $0);
}, function($0) {
 console.log("kai PlatformRenderingContextSetup: emscripten_webgl_make_context_current ->", $0);
}, function($0, $1) {
 console.log("kai PlatformRenderingContextSetup: emscripten_webgl_get_current_context ->", $0, "DSC -> ", $1);
}, function() {
 console.log("CANVAS OBJECT:" + Module["canvas"]);
}, function($0) {
 console.log("kai PlatformSharedContextSetup " + $0);
}, function() {
 Module["canvas"].UE_canvas.bIsFullScreen = 0;
}, function($0, $1) {
 console.log("ERROR: SetLookupKeyGroupName: index[" + $0 + "] num[" + $1 + "]");
 stackTrace();
}, function() {
 var hoststring = location.href.substring(0, location.href.lastIndexOf("/"));
 var buffer = Module._malloc(hoststring.length);
 Module.writeAsciiToMemory(hoststring, buffer);
 return buffer;
}, function() {
 return Module.TOTAL_MEMORY;
}, function() {
 console.log("FHTML5PlatformProcess::SleepInfinite()");
 calling_a_function_that_does_not_exist_in_javascript_will__stop__the_thread_forever();
}, function($0) {
 var InUrl = UTF8ToString($0);
 console.log("Opening " + InUrl);
 window.open(InUrl);
}, function() {
 if (typeof AudioContext !== "undefined") {
  return 1;
 } else if (typeof webkitAudioContext !== "undefined") {
  return 1;
 }
 return 0;
}, function() {
 if (typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia !== "undefined") {
  return 1;
 } else if (typeof navigator.webkitGetUserMedia !== "undefined") {
  return 1;
 }
 return 0;
}, function($0) {
 if (typeof Module["SDL2"] === "undefined") {
  Module["SDL2"] = {};
 }
 var SDL2 = Module["SDL2"];
 if (!$0) {
  SDL2.audio = {};
 } else {
  SDL2.capture = {};
 }
 if (!SDL2.audioContext) {
  if (typeof AudioContext !== "undefined") {
   SDL2.audioContext = new AudioContext();
  } else if (typeof webkitAudioContext !== "undefined") {
   SDL2.audioContext = new webkitAudioContext();
  }
 }
 return SDL2.audioContext === undefined ? -1 : 0;
}, function() {
 var SDL2 = Module["SDL2"];
 return SDL2.audioContext.sampleRate;
}, function($0, $1, $2, $3) {
 var SDL2 = Module["SDL2"];
 var have_microphone = function(stream) {
  if (SDL2.capture.silenceTimer !== undefined) {
   clearTimeout(SDL2.capture.silenceTimer);
   SDL2.capture.silenceTimer = undefined;
  }
  SDL2.capture.mediaStreamNode = SDL2.audioContext.createMediaStreamSource(stream);
  SDL2.capture.scriptProcessorNode = SDL2.audioContext.createScriptProcessor($1, $0, 1);
  SDL2.capture.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {
   if (SDL2 === undefined || SDL2.capture === undefined) {
    return;
   }
   audioProcessingEvent.outputBuffer.getChannelData(0).fill(0);
   SDL2.capture.currentCaptureBuffer = audioProcessingEvent.inputBuffer;
   dynCall("vi", $2, [ $3 ]);
  };
  SDL2.capture.mediaStreamNode.connect(SDL2.capture.scriptProcessorNode);
  SDL2.capture.scriptProcessorNode.connect(SDL2.audioContext.destination);
  SDL2.capture.stream = stream;
 };
 var no_microphone = function(error) {};
 SDL2.capture.silenceBuffer = SDL2.audioContext.createBuffer($0, $1, SDL2.audioContext.sampleRate);
 SDL2.capture.silenceBuffer.getChannelData(0).fill(0);
 var silence_callback = function() {
  SDL2.capture.currentCaptureBuffer = SDL2.capture.silenceBuffer;
  dynCall("vi", $2, [ $3 ]);
 };
 SDL2.capture.silenceTimer = setTimeout(silence_callback, $1 / SDL2.audioContext.sampleRate * 1e3);
 if (navigator.mediaDevices !== undefined && navigator.mediaDevices.getUserMedia !== undefined) {
  navigator.mediaDevices.getUserMedia({
   audio: true,
   video: false
  }).then(have_microphone).catch(no_microphone);
 } else if (navigator.webkitGetUserMedia !== undefined) {
  navigator.webkitGetUserMedia({
   audio: true,
   video: false
  }, have_microphone, no_microphone);
 }
}, function($0, $1, $2, $3) {
 var SDL2 = Module["SDL2"];
 SDL2.audio.scriptProcessorNode = SDL2.audioContext["createScriptProcessor"]($1, 0, $0);
 SDL2.audio.scriptProcessorNode["onaudioprocess"] = function(e) {
  if (SDL2 === undefined || SDL2.audio === undefined) {
   return;
  }
  SDL2.audio.currentOutputBuffer = e["outputBuffer"];
  dynCall("vi", $2, [ $3 ]);
 };
 SDL2.audio.scriptProcessorNode["connect"](SDL2.audioContext["destination"]);
}, function($0) {
 var SDL2 = Module["SDL2"];
 if ($0) {
  if (SDL2.capture.silenceTimer !== undefined) {
   clearTimeout(SDL2.capture.silenceTimer);
  }
  if (SDL2.capture.stream !== undefined) {
   var tracks = SDL2.capture.stream.getAudioTracks();
   for (var i = 0; i < tracks.length; i++) {
    SDL2.capture.stream.removeTrack(tracks[i]);
   }
   SDL2.capture.stream = undefined;
  }
  if (SDL2.capture.scriptProcessorNode !== undefined) {
   SDL2.capture.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {};
   SDL2.capture.scriptProcessorNode.disconnect();
   SDL2.capture.scriptProcessorNode = undefined;
  }
  if (SDL2.capture.mediaStreamNode !== undefined) {
   SDL2.capture.mediaStreamNode.disconnect();
   SDL2.capture.mediaStreamNode = undefined;
  }
  if (SDL2.capture.silenceBuffer !== undefined) {
   SDL2.capture.silenceBuffer = undefined;
  }
  SDL2.capture = undefined;
 } else {
  if (SDL2.audio.scriptProcessorNode != undefined) {
   SDL2.audio.scriptProcessorNode.disconnect();
   SDL2.audio.scriptProcessorNode = undefined;
  }
  SDL2.audio = undefined;
 }
 if (SDL2.audioContext !== undefined && SDL2.audio === undefined && SDL2.capture === undefined) {
  SDL2.audioContext.close();
  SDL2.audioContext = undefined;
 }
}, function($0, $1) {
 var SDL2 = Module["SDL2"];
 var numChannels = SDL2.capture.currentCaptureBuffer.numberOfChannels;
 for (var c = 0; c < numChannels; ++c) {
  var channelData = SDL2.capture.currentCaptureBuffer.getChannelData(c);
  if (channelData.length != $1) {
   throw "Web Audio capture buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
  }
  if (numChannels == 1) {
   for (var j = 0; j < $1; ++j) {
    setValue($0 + j * 4, channelData[j], "float");
   }
  } else {
   for (var j = 0; j < $1; ++j) {
    setValue($0 + (j * numChannels + c) * 4, channelData[j], "float");
   }
  }
 }
}, function($0, $1) {
 var SDL2 = Module["SDL2"];
 var numChannels = SDL2.audio.currentOutputBuffer["numberOfChannels"];
 for (var c = 0; c < numChannels; ++c) {
  var channelData = SDL2.audio.currentOutputBuffer["getChannelData"](c);
  if (channelData.length != $1) {
   throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
  }
  for (var j = 0; j < $1; ++j) {
   channelData[j] = HEAPF32[$0 + (j * numChannels + c << 2) >> 2];
  }
 }
}, function() {
 return screen.width;
}, function() {
 return screen.height;
}, function($0) {
 if (typeof Module["setWindowTitle"] !== "undefined") {
  Module["setWindowTitle"](UTF8ToString($0));
 }
 return 0;
}, function($0, $1, $2) {
 var w = $0;
 var h = $1;
 var pixels = $2;
 if (!Module["SDL2"]) Module["SDL2"] = {};
 var SDL2 = Module["SDL2"];
 if (SDL2.ctxCanvas !== Module["canvas"]) {
  SDL2.ctx = Module["createContext"](Module["canvas"], false, true);
  SDL2.ctxCanvas = Module["canvas"];
 }
 if (SDL2.w !== w || SDL2.h !== h || SDL2.imageCtx !== SDL2.ctx) {
  SDL2.image = SDL2.ctx.createImageData(w, h);
  SDL2.w = w;
  SDL2.h = h;
  SDL2.imageCtx = SDL2.ctx;
 }
 var data = SDL2.image.data;
 var src = pixels >> 2;
 var dst = 0;
 var num;
 if (typeof CanvasPixelArray !== "undefined" && data instanceof CanvasPixelArray) {
  num = data.length;
  while (dst < num) {
   var val = HEAP32[src];
   data[dst] = val & 255;
   data[dst + 1] = val >> 8 & 255;
   data[dst + 2] = val >> 16 & 255;
   data[dst + 3] = 255;
   src++;
   dst += 4;
  }
 } else {
  if (SDL2.data32Data !== data) {
   SDL2.data32 = new Int32Array(data.buffer);
   SDL2.data8 = new Uint8Array(data.buffer);
  }
  var data32 = SDL2.data32;
  num = data32.length;
  data32.set(HEAP32.subarray(src, src + num));
  var data8 = SDL2.data8;
  var i = 3;
  var j = i + 4 * num;
  if (num % 8 == 0) {
   while (i < j) {
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
    data8[i] = 255;
    i = i + 4 | 0;
   }
  } else {
   while (i < j) {
    data8[i] = 255;
    i = i + 4 | 0;
   }
  }
 }
 SDL2.ctx.putImageData(SDL2.image, 0, 0);
 return 0;
}, function($0, $1, $2, $3, $4) {
 var w = $0;
 var h = $1;
 var hot_x = $2;
 var hot_y = $3;
 var pixels = $4;
 var canvas = document.createElement("canvas");
 canvas.width = w;
 canvas.height = h;
 var ctx = canvas.getContext("2d");
 var image = ctx.createImageData(w, h);
 var data = image.data;
 var src = pixels >> 2;
 var dst = 0;
 var num;
 if (typeof CanvasPixelArray !== "undefined" && data instanceof CanvasPixelArray) {
  num = data.length;
  while (dst < num) {
   var val = HEAP32[src];
   data[dst] = val & 255;
   data[dst + 1] = val >> 8 & 255;
   data[dst + 2] = val >> 16 & 255;
   data[dst + 3] = val >> 24 & 255;
   src++;
   dst += 4;
  }
 } else {
  var data32 = new Int32Array(data.buffer);
  num = data32.length;
  data32.set(HEAP32.subarray(src, src + num));
 }
 ctx.putImageData(image, 0, 0);
 var url = hot_x === 0 && hot_y === 0 ? "url(" + canvas.toDataURL() + "), auto" : "url(" + canvas.toDataURL() + ") " + hot_x + " " + hot_y + ", auto";
 var urlBuf = _malloc(url.length + 1);
 stringToUTF8(url, urlBuf, url.length + 1);
 return urlBuf;
}, function($0) {
 if (Module["canvas"]) {
  Module["canvas"].style["cursor"] = UTF8ToString($0);
 }
 return 0;
}, function() {
 if (Module["canvas"]) {
  Module["canvas"].style["cursor"] = "none";
 }
} ];

function _emscripten_asm_const_sync_on_main_thread_i(code) {
 return ASM_CONSTS[code]();
}

function _emscripten_asm_const_i(code) {
 return ASM_CONSTS[code]();
}

function _emscripten_asm_const_iiiiii(code, a0, a1, a2, a3, a4) {
 return ASM_CONSTS[code](a0, a1, a2, a3, a4);
}

function _emscripten_asm_const_iii(code, a0, a1) {
 return ASM_CONSTS[code](a0, a1);
}

function _emscripten_asm_const_iiiiiii(code, a0, a1, a2, a3, a4, a5) {
 return ASM_CONSTS[code](a0, a1, a2, a3, a4, a5);
}

function _emscripten_asm_const_iiiiiiddi(code, a0, a1, a2, a3, a4, a5, a6, a7) {
 return ASM_CONSTS[code](a0, a1, a2, a3, a4, a5, a6, a7);
}

function _emscripten_asm_const_ii(code, a0) {
 return ASM_CONSTS[code](a0);
}

function _emscripten_asm_const_iiii(code, a0, a1, a2) {
 return ASM_CONSTS[code](a0, a1, a2);
}

function _emscripten_asm_const_iiiii(code, a0, a1, a2, a3) {
 return ASM_CONSTS[code](a0, a1, a2, a3);
}

function _emscripten_asm_const_sync_on_main_thread_ii(code, a0) {
 return ASM_CONSTS[code](a0);
}

__ATINIT__.push({
 func: function() {
  globalCtors();
 }
});

var tempDoublePtr = 16109376;

assert(tempDoublePtr % 8 == 0);

var UE_JSlib = {
 UE_SendAndRecievePayLoad: function(request) {
  if (request.UE_fetch.postData) {
   request.open("POST", request.UE_fetch.url, false);
   request.overrideMimeType("text/plain; charset=x-user-defined");
   request.send(request.UE_fetch.postData);
  } else {
   request.open("GET", request.UE_fetch.url, false);
   request.send();
  }
  if (request.status != 200) {
   console.log("Fetching " + _url + " failed: " + request.responseText);
   Module.HEAP32[request.UE_fetch.outsizeptr >> 2] = 0;
   Module.HEAP32[request.UE_fetch.outdataptr >> 2] = 0;
   return;
  }
  var replyString = request.responseText;
  var replyLength = replyString.length;
  var outdata = Module._malloc(replyLength);
  if (!outdata) {
   console.log("Failed to allocate " + replyLength + " bytes in heap for reply");
   Module.HEAP32[request.UE_fetch.outsizeptr >> 2] = 0;
   Module.HEAP32[request.UE_fetch.outdataptr >> 2] = 0;
   return;
  }
  var replyDest = Module.HEAP8.subarray(outdata, outdata + replyLength);
  for (var i = 0; i < replyLength; ++i) {
   replyDest[i] = replyString.charCodeAt(i) & 255;
  }
  Module.HEAP32[request.UE_fetch.outsizeptr >> 2] = replyLength;
  Module.HEAP32[request.UE_fetch.outdataptr >> 2] = outdata;
 },
 onBeforeUnload_callbacks: [],
 onBeforeUnload_debug_helper: function(dummyfile) {
  var debug_xhr = new XMLHttpRequest();
  debug_xhr.open("GET", dummyfile, false);
  debug_xhr.addEventListener("load", function(e) {
   if (debug_xhr.status === 200 || _url.substr(0, 4).toLowerCase() !== "http") console.log("debug_xhr.response: " + debug_xhr.response); else console.log("debug_xhr.response: FAILED");
  });
  debug_xhr.addEventListener("error", function(e) {
   console.log("debug_xhr.onerror: FAILED");
  });
  debug_xhr.send(null);
 },
 onBeforeUnload: function(e) {
  window.removeEventListener("beforeunload", UE_JSlib.onBeforeUnload, false);
  var callbacks = UE_JSlib.onBeforeUnload_callbacks;
  UE_JSlib.onBeforeUnload_callbacks = [];
  for (var x in callbacks) {
   var contexts = callbacks[0].ctx;
   for (var y in contexts) {
    try {
     dynCall("vi", callbacks[x].callback, [ contexts[y] ]);
    } catch (e) {}
   }
  }
 },
 onBeforeUnload_setup: function() {
  window.addEventListener("beforeunload", UE_JSlib.onBeforeUnload);
 }
};

function _UE_BrowserWebGLVersion() {
 if (ENVIRONMENT_IS_WORKER) {
  return 2;
 }
 return Module["WEBGL_VERSION"];
}

function _UE_DeleteSavedGame(name) {
 var _name = UTF8ToString(name);
 return $.jStorage.deleteKey(_name);
}

function _UE_DoesSaveGameExist(name) {
 var _name = UTF8ToString(name);
 var keys = $.jStorage.index();
 for (var i in keys) {
  if (keys[i] == _name) return true;
 }
 return false;
}

function _UE_EngineRegisterCanvasResizeListener(listener) {
 UE_JSlib.UE_CanvasSizeChanged = function() {
  dynCall("v", listener);
 };
}

function _UE_GSystemResolution(resX, resY) {
 UE_JSlib.UE_GSystemResolution_ResX = function() {
  return dynCall("i", resX, []);
 };
 UE_JSlib.UE_GSystemResolution_ResY = function() {
  return dynCall("i", resY, []);
 };
}

function _UE_GetCurrentCultureName(address, outsize) {
 var culture_name = navigator.language || navigator.browserLanguage;
 if (!culture_name) {
  console.warn("UE_GetCurrentCultureName: navigator.language unavailable on pthread; falling back to 'en-US'");
  culture_name = "en-US";
 }
 if (culture_name.length >= outsize) return 0;
 Module.writeAsciiToMemory(culture_name, address);
 return 1;
}

function _UE_LoadGame(name, outdataptr, outsizeptr) {
 var _name = UTF8ToString(name);
 var b64encoded = $.jStorage.get(_name);
 if (b64encoded === null) return false;
 var decodedArray = base64DecToArr(b64encoded);
 var outdata = Module._malloc(decodedArray.length);
 var dest = Module.HEAPU8.subarray(outdata, outdata + decodedArray.length);
 for (var i = 0; i < decodedArray.length; ++i) {
  dest[i] = decodedArray[i];
 }
 Module.HEAP32[outsizeptr >> 2] = decodedArray.length;
 Module.HEAP32[outdataptr >> 2] = outdata;
 return true;
}

function _UE_MakeHTTPDataRequest(ctx, url, verb, payload, payloadsize, headers, async, freeBuffer, onload, onerror, onprogress) {
 var _url = UTF8ToString(url);
 var _verb = UTF8ToString(verb);
 var _headers = UTF8ToString(headers);
 var xhr = new XMLHttpRequest();
 xhr.UE_fetch = {
  verb: _verb,
  url: _url,
  async: !!async,
  postData: null,
  timeout: 2
 };
 if (_verb === "POST") {
  xhr.UE_fetch.postData = Module.HEAP8.subarray(payload, payload + payloadsize);
 }
 xhr.open(_verb, _url, !!async);
 xhr.responseType = "arraybuffer";
 if (_headers != "") {
  var _headerArray = _headers.split("%");
  for (var headerArrayidx = 0; headerArrayidx < _headerArray.length; headerArrayidx++) {
   var header = _headerArray[headerArrayidx].split(":");
   xhr.setRequestHeader(header[0], header[1].trim());
  }
 }
 xhr.addEventListener("load", function(e) {
  if (xhr.status === 200 || _url.substr(0, 4).toLowerCase() !== "http") {
   var headers = xhr.getAllResponseHeaders();
   var header_byteArray = new TextEncoder("utf-8").encode(headers);
   var header_buffer = _malloc(header_byteArray.length);
   HEAPU8.set(header_byteArray, header_buffer);
   var byteArray = new Uint8Array(xhr.response);
   var buffer = _malloc(byteArray.length);
   HEAPU8.set(byteArray, buffer);
   if (onload) dynCall("viiiii", onload, [ ctx, buffer, byteArray.length, header_buffer, xhr.status ]);
   if (freeBuffer) _free(buffer);
   _free(header_buffer);
  } else {
   if (onerror) dynCall("viii", onerror, [ ctx, xhr.status, xhr.statusText ]);
  }
 });
 xhr.addEventListener("error", function(e) {
  if (xhr.responseURL == "") console.log("ERROR: Cross-Origin Resource Sharing [CORS] check FAILED");
  if (onerror) dynCall("viii", onerror, [ ctx, xhr.status, xhr.statusText ]);
 });
 xhr.addEventListener("progress", function(e) {
  if (onprogress) dynCall("viii", onprogress, [ ctx, e.loaded, e.lengthComputable || e.lengthComputable === undefined ? e.total : 0 ]);
 });
 xhr.addEventListener("timeout", function(e) {
  if (!this.UE_fetch.timeout) {
   console.log("Fetching " + this.UE_fetch.url + " timed out");
   if (onerror) dynCall("viii", onerror, [ ctx, xhr.status, xhr.statusText ]);
   return;
  }
  this.UE_fetch.timeout--;
  xhr.open(this.UE_fetch.verb, this.UE_fetch.url, this.UE_fetch.async);
  xhr.responseType = "arraybuffer";
  xhr.send(xhr.UE_fetch.postData);
 });
 try {
  if (xhr.channel instanceof Ci.nsIHttpChannel) xhr.channel.redirectionLimit = 0;
 } catch (ex) {}
 xhr.send(xhr.UE_fetch.postData);
}

function _UE_MessageBox(type, message, caption) {
 var text = UTF8ToString(message);
 if (!type) return confirm(text);
 alert(text);
 return 1;
}

function _UE_SaveGame(name, indata, insize) {
 var _name = UTF8ToString(name);
 var gamedata = Module.HEAPU8.subarray(indata, indata + insize);
 var b64encoded = base64EncArr(gamedata);
 $.jStorage.set(_name, b64encoded);
 return true;
}

function _UE_SendAndRecievePayLoad(url, indata, insize, outdataptr, outsizeptr) {
 var _url = UTF8ToString(url);
 var request = new XMLHttpRequest();
 request.UE_fetch = {
  url: _url,
  outsizeptr: outsizeptr,
  outdataptr: outdataptr,
  timeout: 2
 };
 request.ontimeout = function(e) {
  if (!this.UE_fetch.timeout) {
   console.log("Fetching " + this.UE_fetch.url + " timed out");
   Module.HEAP32[this.UE_fetch.outsizeptr >> 2] = 0;
   Module.HEAP32[this.UE_fetch.outdataptr >> 2] = 0;
   return;
  }
  this.UE_fetch.timeout--;
  return UE_JSlib.UE_SendAndRecievePayLoad(this);
 };
 if (insize && indata) {
  var postData = Module.HEAP8.subarray(indata, indata + insize);
  request.UE_fetch.postData = postData;
 }
 return UE_JSlib.UE_SendAndRecievePayLoad(request);
}

var ENV = {};

function ___buildEnvironment(environ) {
 var MAX_ENV_VALUES = 64;
 var TOTAL_ENV_SIZE = 1024;
 var poolPtr;
 var envPtr;
 if (!___buildEnvironment.called) {
  ___buildEnvironment.called = true;
  ENV["USER"] = ENV["LOGNAME"] = "web_user";
  ENV["PATH"] = "/";
  ENV["PWD"] = "/";
  ENV["HOME"] = "/home/web_user";
  ENV["LANG"] = "C.UTF-8";
  ENV["_"] = Module["thisProgram"];
  poolPtr = getMemory(TOTAL_ENV_SIZE);
  envPtr = getMemory(MAX_ENV_VALUES * 4);
  HEAP32[envPtr >> 2] = poolPtr;
  HEAP32[environ >> 2] = envPtr;
 } else {
  envPtr = HEAP32[environ >> 2];
  poolPtr = HEAP32[envPtr >> 2];
 }
 var strings = [];
 var totalSize = 0;
 for (var key in ENV) {
  if (typeof ENV[key] === "string") {
   var line = key + "=" + ENV[key];
   strings.push(line);
   totalSize += line.length;
  }
 }
 if (totalSize > TOTAL_ENV_SIZE) {
  throw new Error("Environment size exceeded TOTAL_ENV_SIZE!");
 }
 var ptrSize = 4;
 for (var i = 0; i < strings.length; i++) {
  var line = strings[i];
  writeAsciiToMemory(line, poolPtr);
  HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
  poolPtr += line.length + 1;
 }
 HEAP32[envPtr + strings.length * ptrSize >> 2] = 0;
}

function ___cxa_allocate_exception(size) {
 return _malloc(size);
}

function __ZSt18uncaught_exceptionv() {
 return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}

function ___cxa_free_exception(ptr) {
 try {
  return _free(ptr);
 } catch (e) {
  err("exception during cxa_free_exception: " + e);
 }
}

var EXCEPTIONS = {
 last: 0,
 caught: [],
 infos: {},
 deAdjust: function(adjusted) {
  if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
  for (var key in EXCEPTIONS.infos) {
   var ptr = +key;
   var adj = EXCEPTIONS.infos[ptr].adjusted;
   var len = adj.length;
   for (var i = 0; i < len; i++) {
    if (adj[i] === adjusted) {
     return ptr;
    }
   }
  }
  return adjusted;
 },
 addRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount++;
 },
 decRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  assert(info.refcount > 0);
  info.refcount--;
  if (info.refcount === 0 && !info.rethrown) {
   if (info.destructor) {
    Module["dynCall_vi"](info.destructor, ptr);
   }
   delete EXCEPTIONS.infos[ptr];
   ___cxa_free_exception(ptr);
  }
 },
 clearRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount = 0;
 }
};

function ___cxa_begin_catch(ptr) {
 var info = EXCEPTIONS.infos[ptr];
 if (info && !info.caught) {
  info.caught = true;
  __ZSt18uncaught_exceptionv.uncaught_exception--;
 }
 if (info) info.rethrown = false;
 EXCEPTIONS.caught.push(ptr);
 EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
 return ptr;
}

function ___cxa_pure_virtual() {
 ABORT = true;
 throw "Pure virtual function called!";
}

function ___resumeException(ptr) {
 if (!EXCEPTIONS.last) {
  EXCEPTIONS.last = ptr;
 }
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}

function ___cxa_find_matching_catch() {
 var thrown = EXCEPTIONS.last;
 if (!thrown) {
  return (setTempRet0(0), 0) | 0;
 }
 var info = EXCEPTIONS.infos[thrown];
 var throwntype = info.type;
 if (!throwntype) {
  return (setTempRet0(0), thrown) | 0;
 }
 var typeArray = Array.prototype.slice.call(arguments);
 var pointer = Module["___cxa_is_pointer_type"](throwntype);
 if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
 HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
 thrown = ___cxa_find_matching_catch.buffer;
 for (var i = 0; i < typeArray.length; i++) {
  if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
   thrown = HEAP32[thrown >> 2];
   info.adjusted.push(thrown);
   return (setTempRet0(typeArray[i]), thrown) | 0;
  }
 }
 thrown = HEAP32[thrown >> 2];
 return (setTempRet0(throwntype), thrown) | 0;
}

function ___cxa_throw(ptr, type, destructor) {
 EXCEPTIONS.infos[ptr] = {
  ptr: ptr,
  adjusted: [ ptr ],
  type: type,
  destructor: destructor,
  refcount: 0,
  caught: false,
  rethrown: false
 };
 EXCEPTIONS.last = ptr;
 if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
  __ZSt18uncaught_exceptionv.uncaught_exception = 1;
 } else {
  __ZSt18uncaught_exceptionv.uncaught_exception++;
 }
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}

function ___gxx_personality_v0() {}

function ___lock() {}

function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value; else err("failed to set errno from JS");
 return value;
}

function ___map_file(pathname, size) {
 ___setErrNo(1);
 return -1;
}

var PATH = {
 splitPath: function(filename) {
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  return splitPathRe.exec(filename).slice(1);
 },
 normalizeArray: function(parts, allowAboveRoot) {
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
   var last = parts[i];
   if (last === ".") {
    parts.splice(i, 1);
   } else if (last === "..") {
    parts.splice(i, 1);
    up++;
   } else if (up) {
    parts.splice(i, 1);
    up--;
   }
  }
  if (allowAboveRoot) {
   for (;up; up--) {
    parts.unshift("..");
   }
  }
  return parts;
 },
 normalize: function(path) {
  var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
  path = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), !isAbsolute).join("/");
  if (!path && !isAbsolute) {
   path = ".";
  }
  if (path && trailingSlash) {
   path += "/";
  }
  return (isAbsolute ? "/" : "") + path;
 },
 dirname: function(path) {
  var result = PATH.splitPath(path), root = result[0], dir = result[1];
  if (!root && !dir) {
   return ".";
  }
  if (dir) {
   dir = dir.substr(0, dir.length - 1);
  }
  return root + dir;
 },
 basename: function(path) {
  if (path === "/") return "/";
  var lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return path;
  return path.substr(lastSlash + 1);
 },
 extname: function(path) {
  return PATH.splitPath(path)[3];
 },
 join: function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return PATH.normalize(paths.join("/"));
 },
 join2: function(l, r) {
  return PATH.normalize(l + "/" + r);
 },
 resolve: function() {
  var resolvedPath = "", resolvedAbsolute = false;
  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
   var path = i >= 0 ? arguments[i] : FS.cwd();
   if (typeof path !== "string") {
    throw new TypeError("Arguments to path.resolve must be strings");
   } else if (!path) {
    return "";
   }
   resolvedPath = path + "/" + resolvedPath;
   resolvedAbsolute = path.charAt(0) === "/";
  }
  resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
   return !!p;
  }), !resolvedAbsolute).join("/");
  return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
 },
 relative: function(from, to) {
  from = PATH.resolve(from).substr(1);
  to = PATH.resolve(to).substr(1);
  function trim(arr) {
   var start = 0;
   for (;start < arr.length; start++) {
    if (arr[start] !== "") break;
   }
   var end = arr.length - 1;
   for (;end >= 0; end--) {
    if (arr[end] !== "") break;
   }
   if (start > end) return [];
   return arr.slice(start, end - start + 1);
  }
  var fromParts = trim(from.split("/"));
  var toParts = trim(to.split("/"));
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
   outputParts.push("..");
  }
  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join("/");
 }
};

var TTY = {
 ttys: [],
 init: function() {},
 shutdown: function() {},
 register: function(dev, ops) {
  TTY.ttys[dev] = {
   input: [],
   output: [],
   ops: ops
  };
  FS.registerDevice(dev, TTY.stream_ops);
 },
 stream_ops: {
  open: function(stream) {
   var tty = TTY.ttys[stream.node.rdev];
   if (!tty) {
    throw new FS.ErrnoError(19);
   }
   stream.tty = tty;
   stream.seekable = false;
  },
  close: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  flush: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  read: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.get_char) {
    throw new FS.ErrnoError(6);
   }
   var bytesRead = 0;
   for (var i = 0; i < length; i++) {
    var result;
    try {
     result = stream.tty.ops.get_char(stream.tty);
    } catch (e) {
     throw new FS.ErrnoError(5);
    }
    if (result === undefined && bytesRead === 0) {
     throw new FS.ErrnoError(11);
    }
    if (result === null || result === undefined) break;
    bytesRead++;
    buffer[offset + i] = result;
   }
   if (bytesRead) {
    stream.node.timestamp = Date.now();
   }
   return bytesRead;
  },
  write: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.put_char) {
    throw new FS.ErrnoError(6);
   }
   try {
    for (var i = 0; i < length; i++) {
     stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
    }
   } catch (e) {
    throw new FS.ErrnoError(5);
   }
   if (length) {
    stream.node.timestamp = Date.now();
   }
   return i;
  }
 },
 default_tty_ops: {
  get_char: function(tty) {
   if (!tty.input.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
     var BUFSIZE = 256;
     var buf = new Buffer(BUFSIZE);
     var bytesRead = 0;
     var isPosixPlatform = process.platform != "win32";
     var fd = process.stdin.fd;
     if (isPosixPlatform) {
      var usingDevice = false;
      try {
       fd = fs.openSync("/dev/stdin", "r");
       usingDevice = true;
      } catch (e) {}
     }
     try {
      bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
     } catch (e) {
      if (e.toString().indexOf("EOF") != -1) bytesRead = 0; else throw e;
     }
     if (usingDevice) {
      fs.closeSync(fd);
     }
     if (bytesRead > 0) {
      result = buf.slice(0, bytesRead).toString("utf-8");
     } else {
      result = null;
     }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
     result = window.prompt("Input: ");
     if (result !== null) {
      result += "\n";
     }
    } else if (typeof readline == "function") {
     result = readline();
     if (result !== null) {
      result += "\n";
     }
    }
    if (!result) {
     return null;
    }
    tty.input = intArrayFromString(result, true);
   }
   return tty.input.shift();
  },
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 },
 default_tty1_ops: {
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 }
};

var MEMFS = {
 ops_table: null,
 mount: function(mount) {
  return MEMFS.createNode(null, "/", 16384 | 511, 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
   throw new FS.ErrnoError(1);
  }
  if (!MEMFS.ops_table) {
   MEMFS.ops_table = {
    dir: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      lookup: MEMFS.node_ops.lookup,
      mknod: MEMFS.node_ops.mknod,
      rename: MEMFS.node_ops.rename,
      unlink: MEMFS.node_ops.unlink,
      rmdir: MEMFS.node_ops.rmdir,
      readdir: MEMFS.node_ops.readdir,
      symlink: MEMFS.node_ops.symlink
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek
     }
    },
    file: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek,
      read: MEMFS.stream_ops.read,
      write: MEMFS.stream_ops.write,
      allocate: MEMFS.stream_ops.allocate,
      mmap: MEMFS.stream_ops.mmap,
      msync: MEMFS.stream_ops.msync
     }
    },
    link: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      readlink: MEMFS.node_ops.readlink
     },
     stream: {}
    },
    chrdev: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: FS.chrdev_stream_ops
    }
   };
  }
  var node = FS.createNode(parent, name, mode, dev);
  if (FS.isDir(node.mode)) {
   node.node_ops = MEMFS.ops_table.dir.node;
   node.stream_ops = MEMFS.ops_table.dir.stream;
   node.contents = {};
  } else if (FS.isFile(node.mode)) {
   node.node_ops = MEMFS.ops_table.file.node;
   node.stream_ops = MEMFS.ops_table.file.stream;
   node.usedBytes = 0;
   node.contents = null;
  } else if (FS.isLink(node.mode)) {
   node.node_ops = MEMFS.ops_table.link.node;
   node.stream_ops = MEMFS.ops_table.link.stream;
  } else if (FS.isChrdev(node.mode)) {
   node.node_ops = MEMFS.ops_table.chrdev.node;
   node.stream_ops = MEMFS.ops_table.chrdev.stream;
  }
  node.timestamp = Date.now();
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 getFileDataAsRegularArray: function(node) {
  if (node.contents && node.contents.subarray) {
   var arr = [];
   for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
   return arr;
  }
  return node.contents;
 },
 getFileDataAsTypedArray: function(node) {
  if (!node.contents) return new Uint8Array();
  if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
  return new Uint8Array(node.contents);
 },
 expandFileStorage: function(node, newCapacity) {
  var prevCapacity = node.contents ? node.contents.length : 0;
  if (prevCapacity >= newCapacity) return;
  var CAPACITY_DOUBLING_MAX = 1024 * 1024;
  newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
  if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
  var oldContents = node.contents;
  node.contents = new Uint8Array(newCapacity);
  if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  return;
 },
 resizeFileStorage: function(node, newSize) {
  if (node.usedBytes == newSize) return;
  if (newSize == 0) {
   node.contents = null;
   node.usedBytes = 0;
   return;
  }
  if (!node.contents || node.contents.subarray) {
   var oldContents = node.contents;
   node.contents = new Uint8Array(new ArrayBuffer(newSize));
   if (oldContents) {
    node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
   }
   node.usedBytes = newSize;
   return;
  }
  if (!node.contents) node.contents = [];
  if (node.contents.length > newSize) node.contents.length = newSize; else while (node.contents.length < newSize) node.contents.push(0);
  node.usedBytes = newSize;
 },
 node_ops: {
  getattr: function(node) {
   var attr = {};
   attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
   attr.ino = node.id;
   attr.mode = node.mode;
   attr.nlink = 1;
   attr.uid = 0;
   attr.gid = 0;
   attr.rdev = node.rdev;
   if (FS.isDir(node.mode)) {
    attr.size = 4096;
   } else if (FS.isFile(node.mode)) {
    attr.size = node.usedBytes;
   } else if (FS.isLink(node.mode)) {
    attr.size = node.link.length;
   } else {
    attr.size = 0;
   }
   attr.atime = new Date(node.timestamp);
   attr.mtime = new Date(node.timestamp);
   attr.ctime = new Date(node.timestamp);
   attr.blksize = 4096;
   attr.blocks = Math.ceil(attr.size / attr.blksize);
   return attr;
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
   if (attr.size !== undefined) {
    MEMFS.resizeFileStorage(node, attr.size);
   }
  },
  lookup: function(parent, name) {
   throw FS.genericErrors[2];
  },
  mknod: function(parent, name, mode, dev) {
   return MEMFS.createNode(parent, name, mode, dev);
  },
  rename: function(old_node, new_dir, new_name) {
   if (FS.isDir(old_node.mode)) {
    var new_node;
    try {
     new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (new_node) {
     for (var i in new_node.contents) {
      throw new FS.ErrnoError(39);
     }
    }
   }
   delete old_node.parent.contents[old_node.name];
   old_node.name = new_name;
   new_dir.contents[new_name] = old_node;
   old_node.parent = new_dir;
  },
  unlink: function(parent, name) {
   delete parent.contents[name];
  },
  rmdir: function(parent, name) {
   var node = FS.lookupNode(parent, name);
   for (var i in node.contents) {
    throw new FS.ErrnoError(39);
   }
   delete parent.contents[name];
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newname, oldpath) {
   var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
   node.link = oldpath;
   return node;
  },
  readlink: function(node) {
   if (!FS.isLink(node.mode)) {
    throw new FS.ErrnoError(22);
   }
   return node.link;
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   var contents = stream.node.contents;
   if (position >= stream.node.usedBytes) return 0;
   var size = Math.min(stream.node.usedBytes - position, length);
   assert(size >= 0);
   if (size > 8 && contents.subarray) {
    buffer.set(contents.subarray(position, position + size), offset);
   } else {
    for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
   }
   return size;
  },
  write: function(stream, buffer, offset, length, position, canOwn) {
   if (canOwn) {
    warnOnce("file packager has copied file data into memory, but in memory growth we are forced to copy it again (see --no-heap-copy)");
   }
   canOwn = false;
   if (!length) return 0;
   var node = stream.node;
   node.timestamp = Date.now();
   if (buffer.subarray && (!node.contents || node.contents.subarray)) {
    if (canOwn) {
     assert(position === 0, "canOwn must imply no weird position inside the file");
     node.contents = buffer.subarray(offset, offset + length);
     node.usedBytes = length;
     return length;
    } else if (node.usedBytes === 0 && position === 0) {
     node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
     node.usedBytes = length;
     return length;
    } else if (position + length <= node.usedBytes) {
     node.contents.set(buffer.subarray(offset, offset + length), position);
     return length;
    }
   }
   MEMFS.expandFileStorage(node, position + length);
   if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); else {
    for (var i = 0; i < length; i++) {
     node.contents[position + i] = buffer[offset + i];
    }
   }
   node.usedBytes = Math.max(node.usedBytes, position + length);
   return length;
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.usedBytes;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(22);
   }
   return position;
  },
  allocate: function(stream, offset, length) {
   MEMFS.expandFileStorage(stream.node, offset + length);
   stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
  },
  mmap: function(stream, buffer, offset, length, position, prot, flags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(19);
   }
   var ptr;
   var allocated;
   var contents = stream.node.contents;
   if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
    allocated = false;
    ptr = contents.byteOffset;
   } else {
    if (position > 0 || position + length < stream.node.usedBytes) {
     if (contents.subarray) {
      contents = contents.subarray(position, position + length);
     } else {
      contents = Array.prototype.slice.call(contents, position, position + length);
     }
    }
    allocated = true;
    ptr = _malloc(length);
    if (!ptr) {
     throw new FS.ErrnoError(12);
    }
    buffer.set(contents, ptr);
   }
   return {
    ptr: ptr,
    allocated: allocated
   };
  },
  msync: function(stream, buffer, offset, length, mmapFlags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(19);
   }
   if (mmapFlags & 2) {
    return 0;
   }
   var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
   return 0;
  }
 }
};

var IDBFS = {
 dbs: {},
 indexedDB: function() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  var ret = null;
  if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  assert(ret, "IDBFS used, but indexedDB not supported");
  return ret;
 },
 DB_VERSION: 21,
 DB_STORE_NAME: "FILE_DATA",
 mount: function(mount) {
  return MEMFS.mount.apply(null, arguments);
 },
 syncfs: function(mount, populate, callback) {
  IDBFS.getLocalSet(mount, function(err, local) {
   if (err) return callback(err);
   IDBFS.getRemoteSet(mount, function(err, remote) {
    if (err) return callback(err);
    var src = populate ? remote : local;
    var dst = populate ? local : remote;
    IDBFS.reconcile(src, dst, callback);
   });
  });
 },
 getDB: function(name, callback) {
  var db = IDBFS.dbs[name];
  if (db) {
   return callback(null, db);
  }
  var req;
  try {
   req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
  } catch (e) {
   return callback(e);
  }
  if (!req) {
   return callback("Unable to connect to IndexedDB");
  }
  req.onupgradeneeded = function(e) {
   var db = e.target.result;
   var transaction = e.target.transaction;
   var fileStore;
   if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
    fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
   } else {
    fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
   }
   if (!fileStore.indexNames.contains("timestamp")) {
    fileStore.createIndex("timestamp", "timestamp", {
     unique: false
    });
   }
  };
  req.onsuccess = function() {
   db = req.result;
   IDBFS.dbs[name] = db;
   callback(null, db);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 getLocalSet: function(mount, callback) {
  var entries = {};
  function isRealDir(p) {
   return p !== "." && p !== "..";
  }
  function toAbsolute(root) {
   return function(p) {
    return PATH.join2(root, p);
   };
  }
  var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  while (check.length) {
   var path = check.pop();
   var stat;
   try {
    stat = FS.stat(path);
   } catch (e) {
    return callback(e);
   }
   if (FS.isDir(stat.mode)) {
    check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
   }
   entries[path] = {
    timestamp: stat.mtime
   };
  }
  return callback(null, {
   type: "local",
   entries: entries
  });
 },
 getRemoteSet: function(mount, callback) {
  var entries = {};
  IDBFS.getDB(mount.mountpoint, function(err, db) {
   if (err) return callback(err);
   try {
    var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readonly");
    transaction.onerror = function(e) {
     callback(this.error);
     e.preventDefault();
    };
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    var index = store.index("timestamp");
    index.openKeyCursor().onsuccess = function(event) {
     var cursor = event.target.result;
     if (!cursor) {
      return callback(null, {
       type: "remote",
       db: db,
       entries: entries
      });
     }
     entries[cursor.primaryKey] = {
      timestamp: cursor.key
     };
     cursor.continue();
    };
   } catch (e) {
    return callback(e);
   }
  });
 },
 loadLocalEntry: function(path, callback) {
  var stat, node;
  try {
   var lookup = FS.lookupPath(path);
   node = lookup.node;
   stat = FS.stat(path);
  } catch (e) {
   return callback(e);
  }
  if (FS.isDir(stat.mode)) {
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode
   });
  } else if (FS.isFile(stat.mode)) {
   node.contents = MEMFS.getFileDataAsTypedArray(node);
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode,
    contents: node.contents
   });
  } else {
   return callback(new Error("node type not supported"));
  }
 },
 storeLocalEntry: function(path, entry, callback) {
  try {
   if (FS.isDir(entry.mode)) {
    FS.mkdir(path, entry.mode);
   } else if (FS.isFile(entry.mode)) {
    FS.writeFile(path, entry.contents, {
     canOwn: true
    });
   } else {
    return callback(new Error("node type not supported"));
   }
   FS.chmod(path, entry.mode);
   FS.utime(path, entry.timestamp, entry.timestamp);
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 removeLocalEntry: function(path, callback) {
  try {
   var lookup = FS.lookupPath(path);
   var stat = FS.stat(path);
   if (FS.isDir(stat.mode)) {
    FS.rmdir(path);
   } else if (FS.isFile(stat.mode)) {
    FS.unlink(path);
   }
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 loadRemoteEntry: function(store, path, callback) {
  var req = store.get(path);
  req.onsuccess = function(event) {
   callback(null, event.target.result);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 storeRemoteEntry: function(store, path, entry, callback) {
  var req = store.put(entry, path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 removeRemoteEntry: function(store, path, callback) {
  var req = store.delete(path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 reconcile: function(src, dst, callback) {
  var total = 0;
  var create = [];
  Object.keys(src.entries).forEach(function(key) {
   var e = src.entries[key];
   var e2 = dst.entries[key];
   if (!e2 || e.timestamp > e2.timestamp) {
    create.push(key);
    total++;
   }
  });
  var remove = [];
  Object.keys(dst.entries).forEach(function(key) {
   var e = dst.entries[key];
   var e2 = src.entries[key];
   if (!e2) {
    remove.push(key);
    total++;
   }
  });
  if (!total) {
   return callback(null);
  }
  var errored = false;
  var completed = 0;
  var db = src.type === "remote" ? src.db : dst.db;
  var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readwrite");
  var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return callback(err);
    }
    return;
   }
   if (++completed >= total) {
    return callback(null);
   }
  }
  transaction.onerror = function(e) {
   done(this.error);
   e.preventDefault();
  };
  create.sort().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.loadRemoteEntry(store, path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeLocalEntry(path, entry, done);
    });
   } else {
    IDBFS.loadLocalEntry(path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeRemoteEntry(store, path, entry, done);
    });
   }
  });
  remove.sort().reverse().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.removeLocalEntry(path, done);
   } else {
    IDBFS.removeRemoteEntry(store, path, done);
   }
  });
 }
};

var NODEFS = {
 isWindows: false,
 staticInit: function() {
  NODEFS.isWindows = !!process.platform.match(/^win/);
  var flags = process["binding"]("constants");
  if (flags["fs"]) {
   flags = flags["fs"];
  }
  NODEFS.flagsForNodeMap = {
   1024: flags["O_APPEND"],
   64: flags["O_CREAT"],
   128: flags["O_EXCL"],
   0: flags["O_RDONLY"],
   2: flags["O_RDWR"],
   4096: flags["O_SYNC"],
   512: flags["O_TRUNC"],
   1: flags["O_WRONLY"]
  };
 },
 bufferFrom: function(arrayBuffer) {
  return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
 },
 mount: function(mount) {
  assert(ENVIRONMENT_IS_NODE);
  return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
   throw new FS.ErrnoError(22);
  }
  var node = FS.createNode(parent, name, mode);
  node.node_ops = NODEFS.node_ops;
  node.stream_ops = NODEFS.stream_ops;
  return node;
 },
 getMode: function(path) {
  var stat;
  try {
   stat = fs.lstatSync(path);
   if (NODEFS.isWindows) {
    stat.mode = stat.mode | (stat.mode & 292) >> 2;
   }
  } catch (e) {
   if (!e.code) throw e;
   throw new FS.ErrnoError(-e.errno);
  }
  return stat.mode;
 },
 realPath: function(node) {
  var parts = [];
  while (node.parent !== node) {
   parts.push(node.name);
   node = node.parent;
  }
  parts.push(node.mount.opts.root);
  parts.reverse();
  return PATH.join.apply(null, parts);
 },
 flagsForNode: function(flags) {
  flags &= ~2097152;
  flags &= ~2048;
  flags &= ~32768;
  flags &= ~524288;
  var newFlags = 0;
  for (var k in NODEFS.flagsForNodeMap) {
   if (flags & k) {
    newFlags |= NODEFS.flagsForNodeMap[k];
    flags ^= k;
   }
  }
  if (!flags) {
   return newFlags;
  } else {
   throw new FS.ErrnoError(22);
  }
 },
 node_ops: {
  getattr: function(node) {
   var path = NODEFS.realPath(node);
   var stat;
   try {
    stat = fs.lstatSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
   if (NODEFS.isWindows && !stat.blksize) {
    stat.blksize = 4096;
   }
   if (NODEFS.isWindows && !stat.blocks) {
    stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
   }
   return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    nlink: stat.nlink,
    uid: stat.uid,
    gid: stat.gid,
    rdev: stat.rdev,
    size: stat.size,
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    blksize: stat.blksize,
    blocks: stat.blocks
   };
  },
  setattr: function(node, attr) {
   var path = NODEFS.realPath(node);
   try {
    if (attr.mode !== undefined) {
     fs.chmodSync(path, attr.mode);
     node.mode = attr.mode;
    }
    if (attr.timestamp !== undefined) {
     var date = new Date(attr.timestamp);
     fs.utimesSync(path, date, date);
    }
    if (attr.size !== undefined) {
     fs.truncateSync(path, attr.size);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  lookup: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   var mode = NODEFS.getMode(path);
   return NODEFS.createNode(parent, name, mode);
  },
  mknod: function(parent, name, mode, dev) {
   var node = NODEFS.createNode(parent, name, mode, dev);
   var path = NODEFS.realPath(node);
   try {
    if (FS.isDir(node.mode)) {
     fs.mkdirSync(path, node.mode);
    } else {
     fs.writeFileSync(path, "", {
      mode: node.mode
     });
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
   return node;
  },
  rename: function(oldNode, newDir, newName) {
   var oldPath = NODEFS.realPath(oldNode);
   var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
   try {
    fs.renameSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  unlink: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.unlinkSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  rmdir: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.rmdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  readdir: function(node) {
   var path = NODEFS.realPath(node);
   try {
    return fs.readdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  symlink: function(parent, newName, oldPath) {
   var newPath = PATH.join2(NODEFS.realPath(parent), newName);
   try {
    fs.symlinkSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  readlink: function(node) {
   var path = NODEFS.realPath(node);
   try {
    path = fs.readlinkSync(path);
    path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
    return path;
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  }
 },
 stream_ops: {
  open: function(stream) {
   var path = NODEFS.realPath(stream.node);
   try {
    if (FS.isFile(stream.node.mode)) {
     stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  close: function(stream) {
   try {
    if (FS.isFile(stream.node.mode) && stream.nfd) {
     fs.closeSync(stream.nfd);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(-e.errno);
   }
  },
  read: function(stream, buffer, offset, length, position) {
   if (length === 0) return 0;
   try {
    return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(-e.errno);
   }
  },
  write: function(stream, buffer, offset, length, position) {
   try {
    return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(-e.errno);
   }
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     try {
      var stat = fs.fstatSync(stream.nfd);
      position += stat.size;
     } catch (e) {
      throw new FS.ErrnoError(-e.errno);
     }
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(22);
   }
   return position;
  }
 }
};

var WORKERFS = {
 DIR_MODE: 16895,
 FILE_MODE: 33279,
 reader: null,
 mount: function(mount) {
  assert(ENVIRONMENT_IS_WORKER);
  if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
  var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
  var createdParents = {};
  function ensureParent(path) {
   var parts = path.split("/");
   var parent = root;
   for (var i = 0; i < parts.length - 1; i++) {
    var curr = parts.slice(0, i + 1).join("/");
    if (!createdParents[curr]) {
     createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
    }
    parent = createdParents[curr];
   }
   return parent;
  }
  function base(path) {
   var parts = path.split("/");
   return parts[parts.length - 1];
  }
  Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
   WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
  });
  (mount.opts["blobs"] || []).forEach(function(obj) {
   WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
  });
  (mount.opts["packages"] || []).forEach(function(pack) {
   pack["metadata"].files.forEach(function(file) {
    var name = file.filename.substr(1);
    WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end));
   });
  });
  return root;
 },
 createNode: function(parent, name, mode, dev, contents, mtime) {
  var node = FS.createNode(parent, name, mode);
  node.mode = mode;
  node.node_ops = WORKERFS.node_ops;
  node.stream_ops = WORKERFS.stream_ops;
  node.timestamp = (mtime || new Date()).getTime();
  assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
  if (mode === WORKERFS.FILE_MODE) {
   node.size = contents.size;
   node.contents = contents;
  } else {
   node.size = 4096;
   node.contents = {};
  }
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 node_ops: {
  getattr: function(node) {
   return {
    dev: 1,
    ino: undefined,
    mode: node.mode,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: undefined,
    size: node.size,
    atime: new Date(node.timestamp),
    mtime: new Date(node.timestamp),
    ctime: new Date(node.timestamp),
    blksize: 4096,
    blocks: Math.ceil(node.size / 4096)
   };
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
  },
  lookup: function(parent, name) {
   throw new FS.ErrnoError(2);
  },
  mknod: function(parent, name, mode, dev) {
   throw new FS.ErrnoError(1);
  },
  rename: function(oldNode, newDir, newName) {
   throw new FS.ErrnoError(1);
  },
  unlink: function(parent, name) {
   throw new FS.ErrnoError(1);
  },
  rmdir: function(parent, name) {
   throw new FS.ErrnoError(1);
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newName, oldPath) {
   throw new FS.ErrnoError(1);
  },
  readlink: function(node) {
   throw new FS.ErrnoError(1);
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   if (position >= stream.node.size) return 0;
   var chunk = stream.node.contents.slice(position, position + length);
   var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
   buffer.set(new Uint8Array(ab), offset);
   return chunk.size;
  },
  write: function(stream, buffer, offset, length, position) {
   throw new FS.ErrnoError(5);
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.size;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(22);
   }
   return position;
  }
 }
};

var ERRNO_MESSAGES = {
 0: "Success",
 1: "Not super-user",
 2: "No such file or directory",
 3: "No such process",
 4: "Interrupted system call",
 5: "I/O error",
 6: "No such device or address",
 7: "Arg list too long",
 8: "Exec format error",
 9: "Bad file number",
 10: "No children",
 11: "No more processes",
 12: "Not enough core",
 13: "Permission denied",
 14: "Bad address",
 15: "Block device required",
 16: "Mount device busy",
 17: "File exists",
 18: "Cross-device link",
 19: "No such device",
 20: "Not a directory",
 21: "Is a directory",
 22: "Invalid argument",
 23: "Too many open files in system",
 24: "Too many open files",
 25: "Not a typewriter",
 26: "Text file busy",
 27: "File too large",
 28: "No space left on device",
 29: "Illegal seek",
 30: "Read only file system",
 31: "Too many links",
 32: "Broken pipe",
 33: "Math arg out of domain of func",
 34: "Math result not representable",
 35: "File locking deadlock error",
 36: "File or path name too long",
 37: "No record locks available",
 38: "Function not implemented",
 39: "Directory not empty",
 40: "Too many symbolic links",
 42: "No message of desired type",
 43: "Identifier removed",
 44: "Channel number out of range",
 45: "Level 2 not synchronized",
 46: "Level 3 halted",
 47: "Level 3 reset",
 48: "Link number out of range",
 49: "Protocol driver not attached",
 50: "No CSI structure available",
 51: "Level 2 halted",
 52: "Invalid exchange",
 53: "Invalid request descriptor",
 54: "Exchange full",
 55: "No anode",
 56: "Invalid request code",
 57: "Invalid slot",
 59: "Bad font file fmt",
 60: "Device not a stream",
 61: "No data (for no delay io)",
 62: "Timer expired",
 63: "Out of streams resources",
 64: "Machine is not on the network",
 65: "Package not installed",
 66: "The object is remote",
 67: "The link has been severed",
 68: "Advertise error",
 69: "Srmount error",
 70: "Communication error on send",
 71: "Protocol error",
 72: "Multihop attempted",
 73: "Cross mount point (not really error)",
 74: "Trying to read unreadable message",
 75: "Value too large for defined data type",
 76: "Given log. name not unique",
 77: "f.d. invalid for this operation",
 78: "Remote address changed",
 79: "Can   access a needed shared lib",
 80: "Accessing a corrupted shared lib",
 81: ".lib section in a.out corrupted",
 82: "Attempting to link in too many libs",
 83: "Attempting to exec a shared library",
 84: "Illegal byte sequence",
 86: "Streams pipe error",
 87: "Too many users",
 88: "Socket operation on non-socket",
 89: "Destination address required",
 90: "Message too long",
 91: "Protocol wrong type for socket",
 92: "Protocol not available",
 93: "Unknown protocol",
 94: "Socket type not supported",
 95: "Not supported",
 96: "Protocol family not supported",
 97: "Address family not supported by protocol family",
 98: "Address already in use",
 99: "Address not available",
 100: "Network interface is not configured",
 101: "Network is unreachable",
 102: "Connection reset by network",
 103: "Connection aborted",
 104: "Connection reset by peer",
 105: "No buffer space available",
 106: "Socket is already connected",
 107: "Socket is not connected",
 108: "Can't send after socket shutdown",
 109: "Too many references",
 110: "Connection timed out",
 111: "Connection refused",
 112: "Host is down",
 113: "Host is unreachable",
 114: "Socket already connected",
 115: "Connection already in progress",
 116: "Stale file handle",
 122: "Quota exceeded",
 123: "No medium (in tape drive)",
 125: "Operation canceled",
 130: "Previous owner died",
 131: "State not recoverable"
};

var ERRNO_CODES = {
 EPERM: 1,
 ENOENT: 2,
 ESRCH: 3,
 EINTR: 4,
 EIO: 5,
 ENXIO: 6,
 E2BIG: 7,
 ENOEXEC: 8,
 EBADF: 9,
 ECHILD: 10,
 EAGAIN: 11,
 EWOULDBLOCK: 11,
 ENOMEM: 12,
 EACCES: 13,
 EFAULT: 14,
 ENOTBLK: 15,
 EBUSY: 16,
 EEXIST: 17,
 EXDEV: 18,
 ENODEV: 19,
 ENOTDIR: 20,
 EISDIR: 21,
 EINVAL: 22,
 ENFILE: 23,
 EMFILE: 24,
 ENOTTY: 25,
 ETXTBSY: 26,
 EFBIG: 27,
 ENOSPC: 28,
 ESPIPE: 29,
 EROFS: 30,
 EMLINK: 31,
 EPIPE: 32,
 EDOM: 33,
 ERANGE: 34,
 ENOMSG: 42,
 EIDRM: 43,
 ECHRNG: 44,
 EL2NSYNC: 45,
 EL3HLT: 46,
 EL3RST: 47,
 ELNRNG: 48,
 EUNATCH: 49,
 ENOCSI: 50,
 EL2HLT: 51,
 EDEADLK: 35,
 ENOLCK: 37,
 EBADE: 52,
 EBADR: 53,
 EXFULL: 54,
 ENOANO: 55,
 EBADRQC: 56,
 EBADSLT: 57,
 EDEADLOCK: 35,
 EBFONT: 59,
 ENOSTR: 60,
 ENODATA: 61,
 ETIME: 62,
 ENOSR: 63,
 ENONET: 64,
 ENOPKG: 65,
 EREMOTE: 66,
 ENOLINK: 67,
 EADV: 68,
 ESRMNT: 69,
 ECOMM: 70,
 EPROTO: 71,
 EMULTIHOP: 72,
 EDOTDOT: 73,
 EBADMSG: 74,
 ENOTUNIQ: 76,
 EBADFD: 77,
 EREMCHG: 78,
 ELIBACC: 79,
 ELIBBAD: 80,
 ELIBSCN: 81,
 ELIBMAX: 82,
 ELIBEXEC: 83,
 ENOSYS: 38,
 ENOTEMPTY: 39,
 ENAMETOOLONG: 36,
 ELOOP: 40,
 EOPNOTSUPP: 95,
 EPFNOSUPPORT: 96,
 ECONNRESET: 104,
 ENOBUFS: 105,
 EAFNOSUPPORT: 97,
 EPROTOTYPE: 91,
 ENOTSOCK: 88,
 ENOPROTOOPT: 92,
 ESHUTDOWN: 108,
 ECONNREFUSED: 111,
 EADDRINUSE: 98,
 ECONNABORTED: 103,
 ENETUNREACH: 101,
 ENETDOWN: 100,
 ETIMEDOUT: 110,
 EHOSTDOWN: 112,
 EHOSTUNREACH: 113,
 EINPROGRESS: 115,
 EALREADY: 114,
 EDESTADDRREQ: 89,
 EMSGSIZE: 90,
 EPROTONOSUPPORT: 93,
 ESOCKTNOSUPPORT: 94,
 EADDRNOTAVAIL: 99,
 ENETRESET: 102,
 EISCONN: 106,
 ENOTCONN: 107,
 ETOOMANYREFS: 109,
 EUSERS: 87,
 EDQUOT: 122,
 ESTALE: 116,
 ENOTSUP: 95,
 ENOMEDIUM: 123,
 EILSEQ: 84,
 EOVERFLOW: 75,
 ECANCELED: 125,
 ENOTRECOVERABLE: 131,
 EOWNERDEAD: 130,
 ESTRPIPE: 86
};

var FS = {
 root: null,
 mounts: [],
 devices: {},
 streams: [],
 nextInode: 1,
 nameTable: null,
 currentPath: "/",
 initialized: false,
 ignorePermissions: true,
 trackingDelegate: {},
 tracking: {
  openFlags: {
   READ: 1,
   WRITE: 2
  }
 },
 ErrnoError: null,
 genericErrors: {},
 filesystems: null,
 syncFSRequests: 0,
 handleFSError: function(e) {
  if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
  return ___setErrNo(e.errno);
 },
 lookupPath: function(path, opts) {
  path = PATH.resolve(FS.cwd(), path);
  opts = opts || {};
  if (!path) return {
   path: "",
   node: null
  };
  var defaults = {
   follow_mount: true,
   recurse_count: 0
  };
  for (var key in defaults) {
   if (opts[key] === undefined) {
    opts[key] = defaults[key];
   }
  }
  if (opts.recurse_count > 8) {
   throw new FS.ErrnoError(40);
  }
  var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), false);
  var current = FS.root;
  var current_path = "/";
  for (var i = 0; i < parts.length; i++) {
   var islast = i === parts.length - 1;
   if (islast && opts.parent) {
    break;
   }
   current = FS.lookupNode(current, parts[i]);
   current_path = PATH.join2(current_path, parts[i]);
   if (FS.isMountpoint(current)) {
    if (!islast || islast && opts.follow_mount) {
     current = current.mounted.root;
    }
   }
   if (!islast || opts.follow) {
    var count = 0;
    while (FS.isLink(current.mode)) {
     var link = FS.readlink(current_path);
     current_path = PATH.resolve(PATH.dirname(current_path), link);
     var lookup = FS.lookupPath(current_path, {
      recurse_count: opts.recurse_count
     });
     current = lookup.node;
     if (count++ > 40) {
      throw new FS.ErrnoError(40);
     }
    }
   }
  }
  return {
   path: current_path,
   node: current
  };
 },
 getPath: function(node) {
  var path;
  while (true) {
   if (FS.isRoot(node)) {
    var mount = node.mount.mountpoint;
    if (!path) return mount;
    return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
   }
   path = path ? node.name + "/" + path : node.name;
   node = node.parent;
  }
 },
 hashName: function(parentid, name) {
  var hash = 0;
  name = name.toLowerCase();
  for (var i = 0; i < name.length; i++) {
   hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
  }
  return (parentid + hash >>> 0) % FS.nameTable.length;
 },
 hashAddNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  node.name_next = FS.nameTable[hash];
  FS.nameTable[hash] = node;
 },
 hashRemoveNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  if (FS.nameTable[hash] === node) {
   FS.nameTable[hash] = node.name_next;
  } else {
   var current = FS.nameTable[hash];
   while (current) {
    if (current.name_next === node) {
     current.name_next = node.name_next;
     break;
    }
    current = current.name_next;
   }
  }
 },
 lookupNode: function(parent, name) {
  var err = FS.mayLookup(parent);
  if (err) {
   throw new FS.ErrnoError(err, parent);
  }
  var hash = FS.hashName(parent.id, name);
  name = name.toLowerCase();
  for (var node = FS.nameTable[hash]; node; node = node.name_next) {
   var nodeName = node.name;
   nodeName = nodeName.toLowerCase();
   if (node.parent.id === parent.id && nodeName === name) {
    return node;
   }
  }
  return FS.lookup(parent, name);
 },
 createNode: function(parent, name, mode, rdev) {
  if (!FS.FSNode) {
   FS.FSNode = function(parent, name, mode, rdev) {
    if (!parent) {
     parent = this;
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
   };
   FS.FSNode.prototype = {};
   var readMode = 292 | 73;
   var writeMode = 146;
   Object.defineProperties(FS.FSNode.prototype, {
    read: {
     get: function() {
      return (this.mode & readMode) === readMode;
     },
     set: function(val) {
      val ? this.mode |= readMode : this.mode &= ~readMode;
     }
    },
    write: {
     get: function() {
      return (this.mode & writeMode) === writeMode;
     },
     set: function(val) {
      val ? this.mode |= writeMode : this.mode &= ~writeMode;
     }
    },
    isFolder: {
     get: function() {
      return FS.isDir(this.mode);
     }
    },
    isDevice: {
     get: function() {
      return FS.isChrdev(this.mode);
     }
    }
   });
  }
  var node = new FS.FSNode(parent, name, mode, rdev);
  FS.hashAddNode(node);
  return node;
 },
 destroyNode: function(node) {
  FS.hashRemoveNode(node);
 },
 isRoot: function(node) {
  return node === node.parent;
 },
 isMountpoint: function(node) {
  return !!node.mounted;
 },
 isFile: function(mode) {
  return (mode & 61440) === 32768;
 },
 isDir: function(mode) {
  return (mode & 61440) === 16384;
 },
 isLink: function(mode) {
  return (mode & 61440) === 40960;
 },
 isChrdev: function(mode) {
  return (mode & 61440) === 8192;
 },
 isBlkdev: function(mode) {
  return (mode & 61440) === 24576;
 },
 isFIFO: function(mode) {
  return (mode & 61440) === 4096;
 },
 isSocket: function(mode) {
  return (mode & 49152) === 49152;
 },
 flagModes: {
  "r": 0,
  "rs": 1052672,
  "r+": 2,
  "w": 577,
  "wx": 705,
  "xw": 705,
  "w+": 578,
  "wx+": 706,
  "xw+": 706,
  "a": 1089,
  "ax": 1217,
  "xa": 1217,
  "a+": 1090,
  "ax+": 1218,
  "xa+": 1218
 },
 modeStringToFlags: function(str) {
  var flags = FS.flagModes[str];
  if (typeof flags === "undefined") {
   throw new Error("Unknown file open mode: " + str);
  }
  return flags;
 },
 flagsToPermissionString: function(flag) {
  var perms = [ "r", "w", "rw" ][flag & 3];
  if (flag & 512) {
   perms += "w";
  }
  return perms;
 },
 nodePermissions: function(node, perms) {
  if (FS.ignorePermissions) {
   return 0;
  }
  if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
   return 13;
  } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
   return 13;
  } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
   return 13;
  }
  return 0;
 },
 mayLookup: function(dir) {
  var err = FS.nodePermissions(dir, "x");
  if (err) return err;
  if (!dir.node_ops.lookup) return 13;
  return 0;
 },
 mayCreate: function(dir, name) {
  try {
   var node = FS.lookupNode(dir, name);
   return 17;
  } catch (e) {}
  return FS.nodePermissions(dir, "wx");
 },
 mayDelete: function(dir, name, isdir) {
  var node;
  try {
   node = FS.lookupNode(dir, name);
  } catch (e) {
   return e.errno;
  }
  var err = FS.nodePermissions(dir, "wx");
  if (err) {
   return err;
  }
  if (isdir) {
   if (!FS.isDir(node.mode)) {
    return 20;
   }
   if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
    return 16;
   }
  } else {
   if (FS.isDir(node.mode)) {
    return 21;
   }
  }
  return 0;
 },
 mayOpen: function(node, flags) {
  if (!node) {
   return 2;
  }
  if (FS.isLink(node.mode)) {
   return 40;
  } else if (FS.isDir(node.mode)) {
   if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
    return 21;
   }
  }
  return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
 },
 MAX_OPEN_FDS: 4096,
 nextfd: function(fd_start, fd_end) {
  fd_start = fd_start || 0;
  fd_end = fd_end || FS.MAX_OPEN_FDS;
  for (var fd = fd_start; fd <= fd_end; fd++) {
   if (!FS.streams[fd]) {
    return fd;
   }
  }
  throw new FS.ErrnoError(24);
 },
 getStream: function(fd) {
  return FS.streams[fd];
 },
 createStream: function(stream, fd_start, fd_end) {
  if (!FS.FSStream) {
   FS.FSStream = function() {};
   FS.FSStream.prototype = {};
   Object.defineProperties(FS.FSStream.prototype, {
    object: {
     get: function() {
      return this.node;
     },
     set: function(val) {
      this.node = val;
     }
    },
    isRead: {
     get: function() {
      return (this.flags & 2097155) !== 1;
     }
    },
    isWrite: {
     get: function() {
      return (this.flags & 2097155) !== 0;
     }
    },
    isAppend: {
     get: function() {
      return this.flags & 1024;
     }
    }
   });
  }
  var newStream = new FS.FSStream();
  for (var p in stream) {
   newStream[p] = stream[p];
  }
  stream = newStream;
  var fd = FS.nextfd(fd_start, fd_end);
  stream.fd = fd;
  FS.streams[fd] = stream;
  return stream;
 },
 closeStream: function(fd) {
  FS.streams[fd] = null;
 },
 chrdev_stream_ops: {
  open: function(stream) {
   var device = FS.getDevice(stream.node.rdev);
   stream.stream_ops = device.stream_ops;
   if (stream.stream_ops.open) {
    stream.stream_ops.open(stream);
   }
  },
  llseek: function() {
   throw new FS.ErrnoError(29);
  }
 },
 major: function(dev) {
  return dev >> 8;
 },
 minor: function(dev) {
  return dev & 255;
 },
 makedev: function(ma, mi) {
  return ma << 8 | mi;
 },
 registerDevice: function(dev, ops) {
  FS.devices[dev] = {
   stream_ops: ops
  };
 },
 getDevice: function(dev) {
  return FS.devices[dev];
 },
 getMounts: function(mount) {
  var mounts = [];
  var check = [ mount ];
  while (check.length) {
   var m = check.pop();
   mounts.push(m);
   check.push.apply(check, m.mounts);
  }
  return mounts;
 },
 syncfs: function(populate, callback) {
  if (typeof populate === "function") {
   callback = populate;
   populate = false;
  }
  FS.syncFSRequests++;
  if (FS.syncFSRequests > 1) {
   console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
  }
  var mounts = FS.getMounts(FS.root.mount);
  var completed = 0;
  function doCallback(err) {
   assert(FS.syncFSRequests > 0);
   FS.syncFSRequests--;
   return callback(err);
  }
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return doCallback(err);
    }
    return;
   }
   if (++completed >= mounts.length) {
    doCallback(null);
   }
  }
  mounts.forEach(function(mount) {
   if (!mount.type.syncfs) {
    return done(null);
   }
   mount.type.syncfs(mount, populate, done);
  });
 },
 mount: function(type, opts, mountpoint) {
  var root = mountpoint === "/";
  var pseudo = !mountpoint;
  var node;
  if (root && FS.root) {
   throw new FS.ErrnoError(16);
  } else if (!root && !pseudo) {
   var lookup = FS.lookupPath(mountpoint, {
    follow_mount: false
   });
   mountpoint = lookup.path;
   node = lookup.node;
   if (FS.isMountpoint(node)) {
    throw new FS.ErrnoError(16);
   }
   if (!FS.isDir(node.mode)) {
    throw new FS.ErrnoError(20);
   }
  }
  var mount = {
   type: type,
   opts: opts,
   mountpoint: mountpoint,
   mounts: []
  };
  var mountRoot = type.mount(mount);
  mountRoot.mount = mount;
  mount.root = mountRoot;
  if (root) {
   FS.root = mountRoot;
  } else if (node) {
   node.mounted = mount;
   if (node.mount) {
    node.mount.mounts.push(mount);
   }
  }
  return mountRoot;
 },
 unmount: function(mountpoint) {
  var lookup = FS.lookupPath(mountpoint, {
   follow_mount: false
  });
  if (!FS.isMountpoint(lookup.node)) {
   throw new FS.ErrnoError(22);
  }
  var node = lookup.node;
  var mount = node.mounted;
  var mounts = FS.getMounts(mount);
  Object.keys(FS.nameTable).forEach(function(hash) {
   var current = FS.nameTable[hash];
   while (current) {
    var next = current.name_next;
    if (mounts.indexOf(current.mount) !== -1) {
     FS.destroyNode(current);
    }
    current = next;
   }
  });
  node.mounted = null;
  var idx = node.mount.mounts.indexOf(mount);
  assert(idx !== -1);
  node.mount.mounts.splice(idx, 1);
 },
 lookup: function(parent, name) {
  return parent.node_ops.lookup(parent, name);
 },
 mknod: function(path, mode, dev) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  if (!name || name === "." || name === "..") {
   throw new FS.ErrnoError(22);
  }
  var err = FS.mayCreate(parent, name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.mknod) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.mknod(parent, name, mode, dev);
 },
 create: function(path, mode) {
  mode = mode !== undefined ? mode : 438;
  mode &= 4095;
  mode |= 32768;
  return FS.mknod(path, mode, 0);
 },
 mkdir: function(path, mode) {
  mode = mode !== undefined ? mode : 511;
  mode &= 511 | 512;
  mode |= 16384;
  return FS.mknod(path, mode, 0);
 },
 mkdirTree: function(path, mode) {
  var dirs = path.split("/");
  var d = "";
  for (var i = 0; i < dirs.length; ++i) {
   if (!dirs[i]) continue;
   d += "/" + dirs[i];
   try {
    FS.mkdir(d, mode);
   } catch (e) {
    if (e.errno != 17) throw e;
   }
  }
 },
 mkdev: function(path, mode, dev) {
  if (typeof dev === "undefined") {
   dev = mode;
   mode = 438;
  }
  mode |= 8192;
  return FS.mknod(path, mode, dev);
 },
 symlink: function(oldpath, newpath) {
  if (!PATH.resolve(oldpath)) {
   throw new FS.ErrnoError(2);
  }
  var lookup = FS.lookupPath(newpath, {
   parent: true
  });
  var parent = lookup.node;
  if (!parent) {
   throw new FS.ErrnoError(2);
  }
  var newname = PATH.basename(newpath);
  var err = FS.mayCreate(parent, newname);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.symlink) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.symlink(parent, newname, oldpath);
 },
 rename: function(old_path, new_path) {
  var old_dirname = PATH.dirname(old_path);
  var new_dirname = PATH.dirname(new_path);
  var old_name = PATH.basename(old_path);
  var new_name = PATH.basename(new_path);
  var lookup, old_dir, new_dir;
  try {
   lookup = FS.lookupPath(old_path, {
    parent: true
   });
   old_dir = lookup.node;
   lookup = FS.lookupPath(new_path, {
    parent: true
   });
   new_dir = lookup.node;
  } catch (e) {
   throw new FS.ErrnoError(16);
  }
  if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
  if (old_dir.mount !== new_dir.mount) {
   throw new FS.ErrnoError(18);
  }
  var old_node = FS.lookupNode(old_dir, old_name);
  var relative = PATH.relative(old_path, new_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(22);
  }
  relative = PATH.relative(new_path, old_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(39);
  }
  var new_node;
  try {
   new_node = FS.lookupNode(new_dir, new_name);
  } catch (e) {}
  if (old_node === new_node) {
   return;
  }
  var isdir = FS.isDir(old_node.mode);
  var err = FS.mayDelete(old_dir, old_name, isdir);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!old_dir.node_ops.rename) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
   throw new FS.ErrnoError(16);
  }
  if (new_dir !== old_dir) {
   err = FS.nodePermissions(old_dir, "w");
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  try {
   if (FS.trackingDelegate["willMovePath"]) {
    FS.trackingDelegate["willMovePath"](old_path, new_path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
  FS.hashRemoveNode(old_node);
  try {
   old_dir.node_ops.rename(old_node, new_dir, new_name);
  } catch (e) {
   throw e;
  } finally {
   FS.hashAddNode(old_node);
  }
  try {
   if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path);
  } catch (e) {
   console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
 },
 rmdir: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, true);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.rmdir) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.rmdir(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  if (!node.node_ops.readdir) {
   throw new FS.ErrnoError(20);
  }
  return node.node_ops.readdir(node);
 },
 unlink: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, false);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.unlink) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.unlink(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readlink: function(path) {
  var lookup = FS.lookupPath(path);
  var link = lookup.node;
  if (!link) {
   throw new FS.ErrnoError(2);
  }
  if (!link.node_ops.readlink) {
   throw new FS.ErrnoError(22);
  }
  return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
 },
 stat: function(path, dontFollow) {
  var lookup = FS.lookupPath(path, {
   follow: !dontFollow
  });
  var node = lookup.node;
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (!node.node_ops.getattr) {
   throw new FS.ErrnoError(1);
  }
  return node.node_ops.getattr(node);
 },
 lstat: function(path) {
  return FS.stat(path, true);
 },
 chmod: function(path, mode, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   mode: mode & 4095 | node.mode & ~4095,
   timestamp: Date.now()
  });
 },
 lchmod: function(path, mode) {
  FS.chmod(path, mode, true);
 },
 fchmod: function(fd, mode) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chmod(stream.node, mode);
 },
 chown: function(path, uid, gid, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   timestamp: Date.now()
  });
 },
 lchown: function(path, uid, gid) {
  FS.chown(path, uid, gid, true);
 },
 fchown: function(fd, uid, gid) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chown(stream.node, uid, gid);
 },
 truncate: function(path, len) {
  if (len < 0) {
   throw new FS.ErrnoError(22);
  }
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: true
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isDir(node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!FS.isFile(node.mode)) {
   throw new FS.ErrnoError(22);
  }
  var err = FS.nodePermissions(node, "w");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  node.node_ops.setattr(node, {
   size: len,
   timestamp: Date.now()
  });
 },
 ftruncate: function(fd, len) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(22);
  }
  FS.truncate(stream.node, len);
 },
 utime: function(path, atime, mtime) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  node.node_ops.setattr(node, {
   timestamp: Math.max(atime, mtime)
  });
 },
 open: function(path, flags, mode, fd_start, fd_end) {
  if (path === "") {
   throw new FS.ErrnoError(2);
  }
  flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
  mode = typeof mode === "undefined" ? 438 : mode;
  if (flags & 64) {
   mode = mode & 4095 | 32768;
  } else {
   mode = 0;
  }
  var node;
  if (typeof path === "object") {
   node = path;
  } else {
   path = PATH.normalize(path);
   try {
    var lookup = FS.lookupPath(path, {
     follow: !(flags & 131072)
    });
    node = lookup.node;
   } catch (e) {}
  }
  var created = false;
  if (flags & 64) {
   if (node) {
    if (flags & 128) {
     throw new FS.ErrnoError(17);
    }
   } else {
    node = FS.mknod(path, mode, 0);
    created = true;
   }
  }
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (FS.isChrdev(node.mode)) {
   flags &= ~512;
  }
  if (flags & 65536 && !FS.isDir(node.mode)) {
   throw new FS.ErrnoError(20);
  }
  if (!created) {
   var err = FS.mayOpen(node, flags);
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  if (flags & 512) {
   FS.truncate(node, 0);
  }
  flags &= ~(128 | 512);
  var stream = FS.createStream({
   node: node,
   path: FS.getPath(node),
   flags: flags,
   seekable: true,
   position: 0,
   stream_ops: node.stream_ops,
   ungotten: [],
   error: false
  }, fd_start, fd_end);
  if (stream.stream_ops.open) {
   stream.stream_ops.open(stream);
  }
  if (Module["logReadFiles"] && !(flags & 1)) {
   if (!FS.readFiles) FS.readFiles = {};
   if (!(path in FS.readFiles)) {
    FS.readFiles[path] = 1;
    console.log("FS.trackingDelegate error on read file: " + path);
   }
  }
  try {
   if (FS.trackingDelegate["onOpenFile"]) {
    var trackingFlags = 0;
    if ((flags & 2097155) !== 1) {
     trackingFlags |= FS.tracking.openFlags.READ;
    }
    if ((flags & 2097155) !== 0) {
     trackingFlags |= FS.tracking.openFlags.WRITE;
    }
    FS.trackingDelegate["onOpenFile"](path, trackingFlags);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
  }
  return stream;
 },
 close: function(stream) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (stream.getdents) stream.getdents = null;
  try {
   if (stream.stream_ops.close) {
    stream.stream_ops.close(stream);
   }
  } catch (e) {
   throw e;
  } finally {
   FS.closeStream(stream.fd);
  }
  stream.fd = null;
 },
 isClosed: function(stream) {
  return stream.fd === null;
 },
 llseek: function(stream, offset, whence) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (!stream.seekable || !stream.stream_ops.llseek) {
   throw new FS.ErrnoError(29);
  }
  if (whence != 0 && whence != 1 && whence != 2) {
   throw new FS.ErrnoError(22);
  }
  stream.position = stream.stream_ops.llseek(stream, offset, whence);
  stream.ungotten = [];
  return stream.position;
 },
 read: function(stream, buffer, offset, length, position) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.read) {
   throw new FS.ErrnoError(22);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
  if (!seeking) stream.position += bytesRead;
  return bytesRead;
 },
 write: function(stream, buffer, offset, length, position, canOwn) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.write) {
   throw new FS.ErrnoError(22);
  }
  if (stream.flags & 1024) {
   FS.llseek(stream, 0, 2);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
  if (!seeking) stream.position += bytesWritten;
  try {
   if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path);
  } catch (e) {
   console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
  }
  return bytesWritten;
 },
 allocate: function(stream, offset, length) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (offset < 0 || length <= 0) {
   throw new FS.ErrnoError(22);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(19);
  }
  if (!stream.stream_ops.allocate) {
   throw new FS.ErrnoError(95);
  }
  stream.stream_ops.allocate(stream, offset, length);
 },
 mmap: function(stream, buffer, offset, length, position, prot, flags) {
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(13);
  }
  if (!stream.stream_ops.mmap) {
   throw new FS.ErrnoError(19);
  }
  return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
 },
 msync: function(stream, buffer, offset, length, mmapFlags) {
  if (!stream || !stream.stream_ops.msync) {
   return 0;
  }
  return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
 },
 munmap: function(stream) {
  return 0;
 },
 ioctl: function(stream, cmd, arg) {
  if (!stream.stream_ops.ioctl) {
   throw new FS.ErrnoError(25);
  }
  return stream.stream_ops.ioctl(stream, cmd, arg);
 },
 readFile: function(path, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "r";
  opts.encoding = opts.encoding || "binary";
  if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
   throw new Error('Invalid encoding type "' + opts.encoding + '"');
  }
  var ret;
  var stream = FS.open(path, opts.flags);
  var stat = FS.stat(path);
  var length = stat.size;
  var buf = new Uint8Array(length);
  FS.read(stream, buf, 0, length, 0);
  if (opts.encoding === "utf8") {
   ret = UTF8ArrayToString(buf, 0);
  } else if (opts.encoding === "binary") {
   ret = buf;
  }
  FS.close(stream);
  return ret;
 },
 writeFile: function(path, data, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "w";
  var stream = FS.open(path, opts.flags, opts.mode);
  if (typeof data === "string") {
   var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
   var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
   FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
  } else if (ArrayBuffer.isView(data)) {
   FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
  } else {
   throw new Error("Unsupported data type");
  }
  FS.close(stream);
 },
 cwd: function() {
  return FS.currentPath;
 },
 chdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  if (lookup.node === null) {
   throw new FS.ErrnoError(2);
  }
  if (!FS.isDir(lookup.node.mode)) {
   throw new FS.ErrnoError(20);
  }
  var err = FS.nodePermissions(lookup.node, "x");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  FS.currentPath = lookup.path;
 },
 createDefaultDirectories: function() {
  FS.mkdir("/tmp");
  FS.mkdir("/home");
  FS.mkdir("/home/web_user");
 },
 createDefaultDevices: function() {
  FS.mkdir("/dev");
  FS.registerDevice(FS.makedev(1, 3), {
   read: function() {
    return 0;
   },
   write: function(stream, buffer, offset, length, pos) {
    return length;
   }
  });
  FS.mkdev("/dev/null", FS.makedev(1, 3));
  TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
  TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
  FS.mkdev("/dev/tty", FS.makedev(5, 0));
  FS.mkdev("/dev/tty1", FS.makedev(6, 0));
  var random_device;
  if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
   var randomBuffer = new Uint8Array(1);
   random_device = function() {
    crypto.getRandomValues(randomBuffer);
    return randomBuffer[0];
   };
  } else if (ENVIRONMENT_IS_NODE) {
   try {
    var crypto_module = require("crypto");
    random_device = function() {
     return crypto_module["randomBytes"](1)[0];
    };
   } catch (e) {}
  } else {}
  if (!random_device) {
   random_device = function() {
    abort("no cryptographic support found for random_device. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: function(array) { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };");
   };
  }
  FS.createDevice("/dev", "random", random_device);
  FS.createDevice("/dev", "urandom", random_device);
  FS.mkdir("/dev/shm");
  FS.mkdir("/dev/shm/tmp");
 },
 createSpecialDirectories: function() {
  FS.mkdir("/proc");
  FS.mkdir("/proc/self");
  FS.mkdir("/proc/self/fd");
  FS.mount({
   mount: function() {
    var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
    node.node_ops = {
     lookup: function(parent, name) {
      var fd = +name;
      var stream = FS.getStream(fd);
      if (!stream) throw new FS.ErrnoError(9);
      var ret = {
       parent: null,
       mount: {
        mountpoint: "fake"
       },
       node_ops: {
        readlink: function() {
         return stream.path;
        }
       }
      };
      ret.parent = ret;
      return ret;
     }
    };
    return node;
   }
  }, {}, "/proc/self/fd");
 },
 createStandardStreams: function() {
  if (Module["stdin"]) {
   FS.createDevice("/dev", "stdin", Module["stdin"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdin");
  }
  if (Module["stdout"]) {
   FS.createDevice("/dev", "stdout", null, Module["stdout"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdout");
  }
  if (Module["stderr"]) {
   FS.createDevice("/dev", "stderr", null, Module["stderr"]);
  } else {
   FS.symlink("/dev/tty1", "/dev/stderr");
  }
  var stdin = FS.open("/dev/stdin", "r");
  var stdout = FS.open("/dev/stdout", "w");
  var stderr = FS.open("/dev/stderr", "w");
  assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
  assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
  assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
 },
 ensureErrnoError: function() {
  if (FS.ErrnoError) return;
  FS.ErrnoError = function ErrnoError(errno, node) {
   this.node = node;
   this.setErrno = function(errno) {
    this.errno = errno;
    for (var key in ERRNO_CODES) {
     if (ERRNO_CODES[key] === errno) {
      this.code = key;
      break;
     }
    }
   };
   this.setErrno(errno);
   this.message = ERRNO_MESSAGES[errno];
   if (this.stack) Object.defineProperty(this, "stack", {
    value: new Error().stack,
    writable: true
   });
   if (this.stack) this.stack = demangleAll(this.stack);
  };
  FS.ErrnoError.prototype = new Error();
  FS.ErrnoError.prototype.constructor = FS.ErrnoError;
  [ 2 ].forEach(function(code) {
   FS.genericErrors[code] = new FS.ErrnoError(code);
   FS.genericErrors[code].stack = "<generic error, no stack>";
  });
 },
 staticInit: function() {
  FS.ensureErrnoError();
  FS.nameTable = new Array(4096);
  FS.mount(MEMFS, {}, "/");
  FS.createDefaultDirectories();
  FS.createDefaultDevices();
  FS.createSpecialDirectories();
  FS.filesystems = {
   "MEMFS": MEMFS,
   "IDBFS": IDBFS,
   "NODEFS": NODEFS,
   "WORKERFS": WORKERFS
  };
 },
 init: function(input, output, error) {
  assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
  FS.init.initialized = true;
  FS.ensureErrnoError();
  Module["stdin"] = input || Module["stdin"];
  Module["stdout"] = output || Module["stdout"];
  Module["stderr"] = error || Module["stderr"];
  FS.createStandardStreams();
 },
 quit: function() {
  FS.init.initialized = false;
  var fflush = Module["_fflush"];
  if (fflush) fflush(0);
  for (var i = 0; i < FS.streams.length; i++) {
   var stream = FS.streams[i];
   if (!stream) {
    continue;
   }
   FS.close(stream);
  }
 },
 getMode: function(canRead, canWrite) {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
 },
 joinPath: function(parts, forceRelative) {
  var path = PATH.join.apply(null, parts);
  if (forceRelative && path[0] == "/") path = path.substr(1);
  return path;
 },
 absolutePath: function(relative, base) {
  return PATH.resolve(base, relative);
 },
 standardizePath: function(path) {
  return PATH.normalize(path);
 },
 findObject: function(path, dontResolveLastLink) {
  var ret = FS.analyzePath(path, dontResolveLastLink);
  if (ret.exists) {
   return ret.object;
  } else {
   ___setErrNo(ret.error);
   return null;
  }
 },
 analyzePath: function(path, dontResolveLastLink) {
  try {
   var lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   path = lookup.path;
  } catch (e) {}
  var ret = {
   isRoot: false,
   exists: false,
   error: 0,
   name: null,
   path: null,
   object: null,
   parentExists: false,
   parentPath: null,
   parentObject: null
  };
  try {
   var lookup = FS.lookupPath(path, {
    parent: true
   });
   ret.parentExists = true;
   ret.parentPath = lookup.path;
   ret.parentObject = lookup.node;
   ret.name = PATH.basename(path);
   lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   ret.exists = true;
   ret.path = lookup.path;
   ret.object = lookup.node;
   ret.name = lookup.node.name;
   ret.isRoot = lookup.path === "/";
  } catch (e) {
   ret.error = e.errno;
  }
  return ret;
 },
 createFolder: function(parent, name, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.mkdir(path, mode);
 },
 createPath: function(parent, path, canRead, canWrite) {
  parent = typeof parent === "string" ? parent : FS.getPath(parent);
  var parts = path.split("/").reverse();
  while (parts.length) {
   var part = parts.pop();
   if (!part) continue;
   var current = PATH.join2(parent, part);
   try {
    FS.mkdir(current);
   } catch (e) {}
   parent = current;
  }
  return current;
 },
 createFile: function(parent, name, properties, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.create(path, mode);
 },
 createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
  var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
  var mode = FS.getMode(canRead, canWrite);
  var node = FS.create(path, mode);
  if (data) {
   if (typeof data === "string") {
    var arr = new Array(data.length);
    for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
    data = arr;
   }
   FS.chmod(node, mode | 146);
   var stream = FS.open(node, "w");
   FS.write(stream, data, 0, data.length, 0, canOwn);
   FS.close(stream);
   FS.chmod(node, mode);
  }
  return node;
 },
 createDevice: function(parent, name, input, output) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(!!input, !!output);
  if (!FS.createDevice.major) FS.createDevice.major = 64;
  var dev = FS.makedev(FS.createDevice.major++, 0);
  FS.registerDevice(dev, {
   open: function(stream) {
    stream.seekable = false;
   },
   close: function(stream) {
    if (output && output.buffer && output.buffer.length) {
     output(10);
    }
   },
   read: function(stream, buffer, offset, length, pos) {
    var bytesRead = 0;
    for (var i = 0; i < length; i++) {
     var result;
     try {
      result = input();
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
     if (result === undefined && bytesRead === 0) {
      throw new FS.ErrnoError(11);
     }
     if (result === null || result === undefined) break;
     bytesRead++;
     buffer[offset + i] = result;
    }
    if (bytesRead) {
     stream.node.timestamp = Date.now();
    }
    return bytesRead;
   },
   write: function(stream, buffer, offset, length, pos) {
    for (var i = 0; i < length; i++) {
     try {
      output(buffer[offset + i]);
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
    }
    if (length) {
     stream.node.timestamp = Date.now();
    }
    return i;
   }
  });
  return FS.mkdev(path, mode, dev);
 },
 createLink: function(parent, name, target, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  return FS.symlink(target, path);
 },
 forceLoadFile: function(obj) {
  if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
  var success = true;
  if (typeof XMLHttpRequest !== "undefined") {
   throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
  } else if (Module["read"]) {
   try {
    obj.contents = intArrayFromString(Module["read"](obj.url), true);
    obj.usedBytes = obj.contents.length;
   } catch (e) {
    success = false;
   }
  } else {
   throw new Error("Cannot load without read() or XMLHttpRequest.");
  }
  if (!success) ___setErrNo(5);
  return success;
 },
 createLazyFile: function(parent, name, url, canRead, canWrite) {
  function LazyUint8Array() {
   this.lengthKnown = false;
   this.chunks = [];
  }
  LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
   if (idx > this.length - 1 || idx < 0) {
    return undefined;
   }
   var chunkOffset = idx % this.chunkSize;
   var chunkNum = idx / this.chunkSize | 0;
   return this.getter(chunkNum)[chunkOffset];
  };
  LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
   this.getter = getter;
  };
  LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
   var xhr = new XMLHttpRequest();
   xhr.open("HEAD", url, false);
   xhr.send(null);
   if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
   var datalength = Number(xhr.getResponseHeader("Content-length"));
   var header;
   var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
   var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
   var chunkSize = 1024 * 1024;
   if (!hasByteServing) chunkSize = datalength;
   var doXHR = function(from, to) {
    if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
    if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
    if (xhr.overrideMimeType) {
     xhr.overrideMimeType("text/plain; charset=x-user-defined");
    }
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
    if (xhr.response !== undefined) {
     return new Uint8Array(xhr.response || []);
    } else {
     return intArrayFromString(xhr.responseText || "", true);
    }
   };
   var lazyArray = this;
   lazyArray.setDataGetter(function(chunkNum) {
    var start = chunkNum * chunkSize;
    var end = (chunkNum + 1) * chunkSize - 1;
    end = Math.min(end, datalength - 1);
    if (typeof lazyArray.chunks[chunkNum] === "undefined") {
     lazyArray.chunks[chunkNum] = doXHR(start, end);
    }
    if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
    return lazyArray.chunks[chunkNum];
   });
   if (usesGzip || !datalength) {
    chunkSize = datalength = 1;
    datalength = this.getter(0).length;
    chunkSize = datalength;
    console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
   }
   this._length = datalength;
   this._chunkSize = chunkSize;
   this.lengthKnown = true;
  };
  if (typeof XMLHttpRequest !== "undefined") {
   if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
   var lazyArray = new LazyUint8Array();
   Object.defineProperties(lazyArray, {
    length: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._length;
     }
    },
    chunkSize: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._chunkSize;
     }
    }
   });
   var properties = {
    isDevice: false,
    contents: lazyArray
   };
  } else {
   var properties = {
    isDevice: false,
    url: url
   };
  }
  var node = FS.createFile(parent, name, properties, canRead, canWrite);
  if (properties.contents) {
   node.contents = properties.contents;
  } else if (properties.url) {
   node.contents = null;
   node.url = properties.url;
  }
  Object.defineProperties(node, {
   usedBytes: {
    get: function() {
     return this.contents.length;
    }
   }
  });
  var stream_ops = {};
  var keys = Object.keys(node.stream_ops);
  keys.forEach(function(key) {
   var fn = node.stream_ops[key];
   stream_ops[key] = function forceLoadLazyFile() {
    if (!FS.forceLoadFile(node)) {
     throw new FS.ErrnoError(5);
    }
    return fn.apply(null, arguments);
   };
  });
  stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
   if (!FS.forceLoadFile(node)) {
    throw new FS.ErrnoError(5);
   }
   var contents = stream.node.contents;
   if (position >= contents.length) return 0;
   var size = Math.min(contents.length - position, length);
   assert(size >= 0);
   if (contents.slice) {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents[position + i];
    }
   } else {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents.get(position + i);
    }
   }
   return size;
  };
  node.stream_ops = stream_ops;
  return node;
 },
 createPreloadedFile: function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
  Browser.init();
  var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency("cp " + fullname);
  function processData(byteArray) {
   function finish(byteArray) {
    if (preFinish) preFinish();
    if (!dontCreateFile) {
     FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
    if (onload) onload();
    removeRunDependency(dep);
   }
   var handled = false;
   Module["preloadPlugins"].forEach(function(plugin) {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
     plugin["handle"](byteArray, fullname, finish, function() {
      if (onerror) onerror();
      removeRunDependency(dep);
     });
     handled = true;
    }
   });
   if (!handled) finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
   Browser.asyncLoad(url, function(byteArray) {
    processData(byteArray);
   }, onerror);
  } else {
   processData(url);
  }
 },
 indexedDB: function() {
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
 },
 DB_NAME: function() {
  return "EM_FS_" + window.location.pathname;
 },
 DB_VERSION: 20,
 DB_STORE_NAME: "FILE_DATA",
 saveFilesToDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
   console.log("creating db");
   var db = openRequest.result;
   db.createObjectStore(FS.DB_STORE_NAME);
  };
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   var transaction = db.transaction([ FS.DB_STORE_NAME ], "readwrite");
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var putRequest = files.put(FS.analyzePath(path).object.contents, path);
    putRequest.onsuccess = function putRequest_onsuccess() {
     ok++;
     if (ok + fail == total) finish();
    };
    putRequest.onerror = function putRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 },
 loadFilesFromDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = onerror;
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   try {
    var transaction = db.transaction([ FS.DB_STORE_NAME ], "readonly");
   } catch (e) {
    onerror(e);
    return;
   }
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var getRequest = files.get(path);
    getRequest.onsuccess = function getRequest_onsuccess() {
     if (FS.analyzePath(path).exists) {
      FS.unlink(path);
     }
     FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
     ok++;
     if (ok + fail == total) finish();
    };
    getRequest.onerror = function getRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 }
};

var SYSCALLS = {
 DEFAULT_POLLMASK: 5,
 mappings: {},
 umask: 511,
 calculateAt: function(dirfd, path) {
  if (path[0] !== "/") {
   var dir;
   if (dirfd === -100) {
    dir = FS.cwd();
   } else {
    var dirstream = FS.getStream(dirfd);
    if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    dir = dirstream.path;
   }
   path = PATH.join2(dir, path);
  }
  return path;
 },
 doStat: function(func, path, buf) {
  try {
   var stat = func(path);
  } catch (e) {
   if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
    return -ERRNO_CODES.ENOTDIR;
   }
   throw e;
  }
  HEAP32[buf >> 2] = stat.dev;
  HEAP32[buf + 4 >> 2] = 0;
  HEAP32[buf + 8 >> 2] = stat.ino;
  HEAP32[buf + 12 >> 2] = stat.mode;
  HEAP32[buf + 16 >> 2] = stat.nlink;
  HEAP32[buf + 20 >> 2] = stat.uid;
  HEAP32[buf + 24 >> 2] = stat.gid;
  HEAP32[buf + 28 >> 2] = stat.rdev;
  HEAP32[buf + 32 >> 2] = 0;
  tempI64 = [ stat.size >>> 0, (tempDouble = stat.size, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1];
  HEAP32[buf + 48 >> 2] = 4096;
  HEAP32[buf + 52 >> 2] = stat.blocks;
  HEAP32[buf + 56 >> 2] = stat.atime.getTime() / 1e3 | 0;
  HEAP32[buf + 60 >> 2] = 0;
  HEAP32[buf + 64 >> 2] = stat.mtime.getTime() / 1e3 | 0;
  HEAP32[buf + 68 >> 2] = 0;
  HEAP32[buf + 72 >> 2] = stat.ctime.getTime() / 1e3 | 0;
  HEAP32[buf + 76 >> 2] = 0;
  tempI64 = [ stat.ino >>> 0, (tempDouble = stat.ino, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[buf + 80 >> 2] = tempI64[0], HEAP32[buf + 84 >> 2] = tempI64[1];
  return 0;
 },
 doMsync: function(addr, stream, len, flags) {
  var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
  FS.msync(stream, buffer, 0, len, flags);
 },
 doMkdir: function(path, mode) {
  path = PATH.normalize(path);
  if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
  FS.mkdir(path, mode, 0);
  return 0;
 },
 doMknod: function(path, mode, dev) {
  switch (mode & 61440) {
  case 32768:
  case 8192:
  case 24576:
  case 4096:
  case 49152:
   break;

  default:
   return -ERRNO_CODES.EINVAL;
  }
  FS.mknod(path, mode, dev);
  return 0;
 },
 doReadlink: function(path, buf, bufsize) {
  if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
  var ret = FS.readlink(path);
  var len = Math.min(bufsize, lengthBytesUTF8(ret));
  var endChar = HEAP8[buf + len];
  stringToUTF8(ret, buf, bufsize + 1);
  HEAP8[buf + len] = endChar;
  return len;
 },
 doAccess: function(path, amode) {
  if (amode & ~7) {
   return -ERRNO_CODES.EINVAL;
  }
  var node;
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  node = lookup.node;
  var perms = "";
  if (amode & 4) perms += "r";
  if (amode & 2) perms += "w";
  if (amode & 1) perms += "x";
  if (perms && FS.nodePermissions(node, perms)) {
   return -ERRNO_CODES.EACCES;
  }
  return 0;
 },
 doDup: function(path, flags, suggestFD) {
  var suggest = FS.getStream(suggestFD);
  if (suggest) FS.close(suggest);
  return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
 },
 doReadv: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.read(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
   if (curr < len) break;
  }
  return ret;
 },
 doWritev: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.write(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
  }
  return ret;
 },
 varargs: 0,
 get: function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function() {
  var ret = UTF8ToString(SYSCALLS.get());
  return ret;
 },
 getStreamFromFD: function() {
  var stream = FS.getStream(SYSCALLS.get());
  if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return stream;
 },
 getSocketFromFD: function() {
  var socket = SOCKFS.getSocket(SYSCALLS.get());
  if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return socket;
 },
 getSocketAddress: function(allowNull) {
  var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
  if (allowNull && addrp === 0) return null;
  var info = __read_sockaddr(addrp, addrlen);
  if (info.errno) throw new FS.ErrnoError(info.errno);
  info.addr = DNS.lookup_addr(info.addr) || info.addr;
  return info;
 },
 get64: function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  if (low >= 0) assert(high === 0); else assert(high === -1);
  return low;
 },
 getZero: function() {
  assert(SYSCALLS.get() === 0);
 }
};

function ___syscall10(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr();
  FS.unlink(path);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

var SOCKFS = {
 mount: function(mount) {
  Module["websocket"] = Module["websocket"] && "object" === typeof Module["websocket"] ? Module["websocket"] : {};
  Module["websocket"]._callbacks = {};
  Module["websocket"]["on"] = function(event, callback) {
   if ("function" === typeof callback) {
    this._callbacks[event] = callback;
   }
   return this;
  };
  Module["websocket"].emit = function(event, param) {
   if ("function" === typeof this._callbacks[event]) {
    this._callbacks[event].call(this, param);
   }
  };
  return FS.createNode(null, "/", 16384 | 511, 0);
 },
 createSocket: function(family, type, protocol) {
  var streaming = type == 1;
  if (protocol) {
   assert(streaming == (protocol == 6));
  }
  var sock = {
   family: family,
   type: type,
   protocol: protocol,
   server: null,
   error: null,
   peers: {},
   pending: [],
   recv_queue: [],
   sock_ops: SOCKFS.websocket_sock_ops
  };
  var name = SOCKFS.nextname();
  var node = FS.createNode(SOCKFS.root, name, 49152, 0);
  node.sock = sock;
  var stream = FS.createStream({
   path: name,
   node: node,
   flags: FS.modeStringToFlags("r+"),
   seekable: false,
   stream_ops: SOCKFS.stream_ops
  });
  sock.stream = stream;
  return sock;
 },
 getSocket: function(fd) {
  var stream = FS.getStream(fd);
  if (!stream || !FS.isSocket(stream.node.mode)) {
   return null;
  }
  return stream.node.sock;
 },
 stream_ops: {
  poll: function(stream) {
   var sock = stream.node.sock;
   return sock.sock_ops.poll(sock);
  },
  ioctl: function(stream, request, varargs) {
   var sock = stream.node.sock;
   return sock.sock_ops.ioctl(sock, request, varargs);
  },
  read: function(stream, buffer, offset, length, position) {
   var sock = stream.node.sock;
   var msg = sock.sock_ops.recvmsg(sock, length);
   if (!msg) {
    return 0;
   }
   buffer.set(msg.buffer, offset);
   return msg.buffer.length;
  },
  write: function(stream, buffer, offset, length, position) {
   var sock = stream.node.sock;
   return sock.sock_ops.sendmsg(sock, buffer, offset, length);
  },
  close: function(stream) {
   var sock = stream.node.sock;
   sock.sock_ops.close(sock);
  }
 },
 nextname: function() {
  if (!SOCKFS.nextname.current) {
   SOCKFS.nextname.current = 0;
  }
  return "socket[" + SOCKFS.nextname.current++ + "]";
 },
 websocket_sock_ops: {
  createPeer: function(sock, addr, port) {
   var ws;
   if (typeof addr === "object") {
    ws = addr;
    addr = null;
    port = null;
   }
   if (ws) {
    if (ws._socket) {
     addr = ws._socket.remoteAddress;
     port = ws._socket.remotePort;
    } else {
     var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
     if (!result) {
      throw new Error("WebSocket URL must be in the format ws(s)://address:port");
     }
     addr = result[1];
     port = parseInt(result[2], 10);
    }
   } else {
    try {
     var runtimeConfig = Module["websocket"] && "object" === typeof Module["websocket"];
     var url = "ws:#".replace("#", "//");
     if (runtimeConfig) {
      if ("string" === typeof Module["websocket"]["url"]) {
       url = Module["websocket"]["url"];
      }
     }
     if (url === "ws://" || url === "wss://") {
      var parts = addr.split("/");
      url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/");
     }
     var subProtocols = "binary";
     if (runtimeConfig) {
      if ("string" === typeof Module["websocket"]["subprotocol"]) {
       subProtocols = Module["websocket"]["subprotocol"];
      }
     }
     subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
     var opts = ENVIRONMENT_IS_NODE ? {
      "protocol": subProtocols.toString()
     } : subProtocols;
     if (runtimeConfig && null === Module["websocket"]["subprotocol"]) {
      subProtocols = "null";
      opts = undefined;
     }
     var WebSocketConstructor;
     if (ENVIRONMENT_IS_NODE) {
      WebSocketConstructor = require("ws");
     } else if (ENVIRONMENT_IS_WEB) {
      WebSocketConstructor = window["WebSocket"];
     } else {
      WebSocketConstructor = WebSocket;
     }
     ws = new WebSocketConstructor(url, opts);
     ws.binaryType = "arraybuffer";
    } catch (e) {
     throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
    }
   }
   var peer = {
    addr: addr,
    port: port,
    socket: ws,
    dgram_send_queue: []
   };
   SOCKFS.websocket_sock_ops.addPeer(sock, peer);
   SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
   if (sock.type === 2 && typeof sock.sport !== "undefined") {
    peer.dgram_send_queue.push(new Uint8Array([ 255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), (sock.sport & 65280) >> 8, sock.sport & 255 ]));
   }
   return peer;
  },
  getPeer: function(sock, addr, port) {
   return sock.peers[addr + ":" + port];
  },
  addPeer: function(sock, peer) {
   sock.peers[peer.addr + ":" + peer.port] = peer;
  },
  removePeer: function(sock, peer) {
   delete sock.peers[peer.addr + ":" + peer.port];
  },
  handlePeerEvents: function(sock, peer) {
   var first = true;
   var handleOpen = function() {
    Module["websocket"].emit("open", sock.stream.fd);
    try {
     var queued = peer.dgram_send_queue.shift();
     while (queued) {
      peer.socket.send(queued);
      queued = peer.dgram_send_queue.shift();
     }
    } catch (e) {
     peer.socket.close();
    }
   };
   function handleMessage(data) {
    assert(typeof data !== "string" && data.byteLength !== undefined);
    if (data.byteLength == 0) {
     return;
    }
    data = new Uint8Array(data);
    var wasfirst = first;
    first = false;
    if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
     var newport = data[8] << 8 | data[9];
     SOCKFS.websocket_sock_ops.removePeer(sock, peer);
     peer.port = newport;
     SOCKFS.websocket_sock_ops.addPeer(sock, peer);
     return;
    }
    sock.recv_queue.push({
     addr: peer.addr,
     port: peer.port,
     data: data
    });
    Module["websocket"].emit("message", sock.stream.fd);
   }
   if (ENVIRONMENT_IS_NODE) {
    peer.socket.on("open", handleOpen);
    peer.socket.on("message", function(data, flags) {
     if (!flags.binary) {
      return;
     }
     handleMessage(new Uint8Array(data).buffer);
    });
    peer.socket.on("close", function() {
     Module["websocket"].emit("close", sock.stream.fd);
    });
    peer.socket.on("error", function(error) {
     sock.error = ERRNO_CODES.ECONNREFUSED;
     Module["websocket"].emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
    });
   } else {
    peer.socket.onopen = handleOpen;
    peer.socket.onclose = function() {
     Module["websocket"].emit("close", sock.stream.fd);
    };
    peer.socket.onmessage = function peer_socket_onmessage(event) {
     handleMessage(event.data);
    };
    peer.socket.onerror = function(error) {
     sock.error = ERRNO_CODES.ECONNREFUSED;
     Module["websocket"].emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
    };
   }
  },
  poll: function(sock) {
   if (sock.type === 1 && sock.server) {
    return sock.pending.length ? 64 | 1 : 0;
   }
   var mask = 0;
   var dest = sock.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
   if (sock.recv_queue.length || !dest || dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
    mask |= 64 | 1;
   }
   if (!dest || dest && dest.socket.readyState === dest.socket.OPEN) {
    mask |= 4;
   }
   if (dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
    mask |= 16;
   }
   return mask;
  },
  ioctl: function(sock, request, arg) {
   switch (request) {
   case 21531:
    var bytes = 0;
    if (sock.recv_queue.length) {
     bytes = sock.recv_queue[0].data.length;
    }
    HEAP32[arg >> 2] = bytes;
    return 0;

   default:
    return ERRNO_CODES.EINVAL;
   }
  },
  close: function(sock) {
   if (sock.server) {
    try {
     sock.server.close();
    } catch (e) {}
    sock.server = null;
   }
   var peers = Object.keys(sock.peers);
   for (var i = 0; i < peers.length; i++) {
    var peer = sock.peers[peers[i]];
    try {
     peer.socket.close();
    } catch (e) {}
    SOCKFS.websocket_sock_ops.removePeer(sock, peer);
   }
   return 0;
  },
  bind: function(sock, addr, port) {
   if (typeof sock.saddr !== "undefined" || typeof sock.sport !== "undefined") {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   sock.saddr = addr;
   sock.sport = port;
   if (sock.type === 2) {
    if (sock.server) {
     sock.server.close();
     sock.server = null;
    }
    try {
     sock.sock_ops.listen(sock, 0);
    } catch (e) {
     if (!(e instanceof FS.ErrnoError)) throw e;
     if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e;
    }
   }
  },
  connect: function(sock, addr, port) {
   if (sock.server) {
    throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
   }
   if (typeof sock.daddr !== "undefined" && typeof sock.dport !== "undefined") {
    var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
    if (dest) {
     if (dest.socket.readyState === dest.socket.CONNECTING) {
      throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
     } else {
      throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
     }
    }
   }
   var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
   sock.daddr = peer.addr;
   sock.dport = peer.port;
   throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
  },
  listen: function(sock, backlog) {
   if (!ENVIRONMENT_IS_NODE) {
    throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
   }
   if (sock.server) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   var WebSocketServer = require("ws").Server;
   var host = sock.saddr;
   sock.server = new WebSocketServer({
    host: host,
    port: sock.sport
   });
   Module["websocket"].emit("listen", sock.stream.fd);
   sock.server.on("connection", function(ws) {
    if (sock.type === 1) {
     var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
     var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
     newsock.daddr = peer.addr;
     newsock.dport = peer.port;
     sock.pending.push(newsock);
     Module["websocket"].emit("connection", newsock.stream.fd);
    } else {
     SOCKFS.websocket_sock_ops.createPeer(sock, ws);
     Module["websocket"].emit("connection", sock.stream.fd);
    }
   });
   sock.server.on("closed", function() {
    Module["websocket"].emit("close", sock.stream.fd);
    sock.server = null;
   });
   sock.server.on("error", function(error) {
    sock.error = ERRNO_CODES.EHOSTUNREACH;
    Module["websocket"].emit("error", [ sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable" ]);
   });
  },
  accept: function(listensock) {
   if (!listensock.server) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   var newsock = listensock.pending.shift();
   newsock.stream.flags = listensock.stream.flags;
   return newsock;
  },
  getname: function(sock, peer) {
   var addr, port;
   if (peer) {
    if (sock.daddr === undefined || sock.dport === undefined) {
     throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
    }
    addr = sock.daddr;
    port = sock.dport;
   } else {
    addr = sock.saddr || 0;
    port = sock.sport || 0;
   }
   return {
    addr: addr,
    port: port
   };
  },
  sendmsg: function(sock, buffer, offset, length, addr, port) {
   if (sock.type === 2) {
    if (addr === undefined || port === undefined) {
     addr = sock.daddr;
     port = sock.dport;
    }
    if (addr === undefined || port === undefined) {
     throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
    }
   } else {
    addr = sock.daddr;
    port = sock.dport;
   }
   var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
   if (sock.type === 1) {
    if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
     throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
    } else if (dest.socket.readyState === dest.socket.CONNECTING) {
     throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
    }
   }
   if (ArrayBuffer.isView(buffer)) {
    offset += buffer.byteOffset;
    buffer = buffer.buffer;
   }
   var data;
   data = buffer.slice(offset, offset + length);
   if (sock.type === 2) {
    if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
     if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
      dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
     }
     dest.dgram_send_queue.push(data);
     return length;
    }
   }
   try {
    dest.socket.send(data);
    return length;
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
  },
  recvmsg: function(sock, length) {
   if (sock.type === 1 && sock.server) {
    throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
   }
   var queued = sock.recv_queue.shift();
   if (!queued) {
    if (sock.type === 1) {
     var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
     if (!dest) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
     } else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
      return null;
     } else {
      throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
     }
    } else {
     throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
    }
   }
   var queuedLength = queued.data.byteLength || queued.data.length;
   var queuedOffset = queued.data.byteOffset || 0;
   var queuedBuffer = queued.data.buffer || queued.data;
   var bytesRead = Math.min(length, queuedLength);
   var res = {
    buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
    addr: queued.addr,
    port: queued.port
   };
   if (sock.type === 1 && bytesRead < queuedLength) {
    var bytesRemaining = queuedLength - bytesRead;
    queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
    sock.recv_queue.unshift(queued);
   }
   return res;
  }
 }
};

function __inet_pton4_raw(str) {
 var b = str.split(".");
 for (var i = 0; i < 4; i++) {
  var tmp = Number(b[i]);
  if (isNaN(tmp)) return null;
  b[i] = tmp;
 }
 return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0;
}

function __inet_pton6_raw(str) {
 var words;
 var w, offset, z;
 var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
 var parts = [];
 if (!valid6regx.test(str)) {
  return null;
 }
 if (str === "::") {
  return [ 0, 0, 0, 0, 0, 0, 0, 0 ];
 }
 if (str.indexOf("::") === 0) {
  str = str.replace("::", "Z:");
 } else {
  str = str.replace("::", ":Z:");
 }
 if (str.indexOf(".") > 0) {
  str = str.replace(new RegExp("[.]", "g"), ":");
  words = str.split(":");
  words[words.length - 4] = parseInt(words[words.length - 4]) + parseInt(words[words.length - 3]) * 256;
  words[words.length - 3] = parseInt(words[words.length - 2]) + parseInt(words[words.length - 1]) * 256;
  words = words.slice(0, words.length - 2);
 } else {
  words = str.split(":");
 }
 offset = 0;
 z = 0;
 for (w = 0; w < words.length; w++) {
  if (typeof words[w] === "string") {
   if (words[w] === "Z") {
    for (z = 0; z < 8 - words.length + 1; z++) {
     parts[w + z] = 0;
    }
    offset = z - 1;
   } else {
    parts[w + offset] = _htons(parseInt(words[w], 16));
   }
  } else {
   parts[w + offset] = words[w];
  }
 }
 return [ parts[1] << 16 | parts[0], parts[3] << 16 | parts[2], parts[5] << 16 | parts[4], parts[7] << 16 | parts[6] ];
}

var DNS = {
 address_map: {
  id: 1,
  addrs: {},
  names: {}
 },
 lookup_name: function(name) {
  var res = __inet_pton4_raw(name);
  if (res !== null) {
   return name;
  }
  res = __inet_pton6_raw(name);
  if (res !== null) {
   return name;
  }
  var addr;
  if (DNS.address_map.addrs[name]) {
   addr = DNS.address_map.addrs[name];
  } else {
   var id = DNS.address_map.id++;
   assert(id < 65535, "exceeded max address mappings of 65535");
   addr = "172.29." + (id & 255) + "." + (id & 65280);
   DNS.address_map.names[addr] = name;
   DNS.address_map.addrs[name] = addr;
  }
  return addr;
 },
 lookup_addr: function(addr) {
  if (DNS.address_map.names[addr]) {
   return DNS.address_map.names[addr];
  }
  return null;
 }
};

function __inet_ntop4_raw(addr) {
 return (addr & 255) + "." + (addr >> 8 & 255) + "." + (addr >> 16 & 255) + "." + (addr >> 24 & 255);
}

function __inet_ntop6_raw(ints) {
 var str = "";
 var word = 0;
 var longest = 0;
 var lastzero = 0;
 var zstart = 0;
 var len = 0;
 var i = 0;
 var parts = [ ints[0] & 65535, ints[0] >> 16, ints[1] & 65535, ints[1] >> 16, ints[2] & 65535, ints[2] >> 16, ints[3] & 65535, ints[3] >> 16 ];
 var hasipv4 = true;
 var v4part = "";
 for (i = 0; i < 5; i++) {
  if (parts[i] !== 0) {
   hasipv4 = false;
   break;
  }
 }
 if (hasipv4) {
  v4part = __inet_ntop4_raw(parts[6] | parts[7] << 16);
  if (parts[5] === -1) {
   str = "::ffff:";
   str += v4part;
   return str;
  }
  if (parts[5] === 0) {
   str = "::";
   if (v4part === "0.0.0.0") v4part = "";
   if (v4part === "0.0.0.1") v4part = "1";
   str += v4part;
   return str;
  }
 }
 for (word = 0; word < 8; word++) {
  if (parts[word] === 0) {
   if (word - lastzero > 1) {
    len = 0;
   }
   lastzero = word;
   len++;
  }
  if (len > longest) {
   longest = len;
   zstart = word - longest + 1;
  }
 }
 for (word = 0; word < 8; word++) {
  if (longest > 1) {
   if (parts[word] === 0 && word >= zstart && word < zstart + longest) {
    if (word === zstart) {
     str += ":";
     if (zstart === 0) str += ":";
    }
    continue;
   }
  }
  str += Number(_ntohs(parts[word] & 65535)).toString(16);
  str += word < 7 ? ":" : "";
 }
 return str;
}

function __read_sockaddr(sa, salen) {
 var family = HEAP16[sa >> 1];
 var port = _ntohs(HEAP16[sa + 2 >> 1]);
 var addr;
 switch (family) {
 case 2:
  if (salen !== 16) {
   return {
    errno: 22
   };
  }
  addr = HEAP32[sa + 4 >> 2];
  addr = __inet_ntop4_raw(addr);
  break;

 case 10:
  if (salen !== 28) {
   return {
    errno: 22
   };
  }
  addr = [ HEAP32[sa + 8 >> 2], HEAP32[sa + 12 >> 2], HEAP32[sa + 16 >> 2], HEAP32[sa + 20 >> 2] ];
  addr = __inet_ntop6_raw(addr);
  break;

 default:
  return {
   errno: 97
  };
 }
 return {
  family: family,
  addr: addr,
  port: port
 };
}

function __write_sockaddr(sa, family, addr, port) {
 switch (family) {
 case 2:
  addr = __inet_pton4_raw(addr);
  HEAP16[sa >> 1] = family;
  HEAP32[sa + 4 >> 2] = addr;
  HEAP16[sa + 2 >> 1] = _htons(port);
  break;

 case 10:
  addr = __inet_pton6_raw(addr);
  HEAP32[sa >> 2] = family;
  HEAP32[sa + 8 >> 2] = addr[0];
  HEAP32[sa + 12 >> 2] = addr[1];
  HEAP32[sa + 16 >> 2] = addr[2];
  HEAP32[sa + 20 >> 2] = addr[3];
  HEAP16[sa + 2 >> 1] = _htons(port);
  HEAP32[sa + 4 >> 2] = 0;
  HEAP32[sa + 24 >> 2] = 0;
  break;

 default:
  return {
   errno: 97
  };
 }
 return {};
}

function ___syscall102(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var call = SYSCALLS.get(), socketvararg = SYSCALLS.get();
  SYSCALLS.varargs = socketvararg;
  switch (call) {
  case 1:
   {
    var domain = SYSCALLS.get(), type = SYSCALLS.get(), protocol = SYSCALLS.get();
    var sock = SOCKFS.createSocket(domain, type, protocol);
    assert(sock.stream.fd < 64);
    return sock.stream.fd;
   }

  case 2:
   {
    var sock = SYSCALLS.getSocketFromFD(), info = SYSCALLS.getSocketAddress();
    sock.sock_ops.bind(sock, info.addr, info.port);
    return 0;
   }

  case 3:
   {
    var sock = SYSCALLS.getSocketFromFD(), info = SYSCALLS.getSocketAddress();
    sock.sock_ops.connect(sock, info.addr, info.port);
    return 0;
   }

  case 4:
   {
    var sock = SYSCALLS.getSocketFromFD(), backlog = SYSCALLS.get();
    sock.sock_ops.listen(sock, backlog);
    return 0;
   }

  case 5:
   {
    var sock = SYSCALLS.getSocketFromFD(), addr = SYSCALLS.get(), addrlen = SYSCALLS.get();
    var newsock = sock.sock_ops.accept(sock);
    if (addr) {
     var res = __write_sockaddr(addr, newsock.family, DNS.lookup_name(newsock.daddr), newsock.dport);
     assert(!res.errno);
    }
    return newsock.stream.fd;
   }

  case 6:
   {
    var sock = SYSCALLS.getSocketFromFD(), addr = SYSCALLS.get(), addrlen = SYSCALLS.get();
    var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.saddr || "0.0.0.0"), sock.sport);
    assert(!res.errno);
    return 0;
   }

  case 7:
   {
    var sock = SYSCALLS.getSocketFromFD(), addr = SYSCALLS.get(), addrlen = SYSCALLS.get();
    if (!sock.daddr) {
     return -ERRNO_CODES.ENOTCONN;
    }
    var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.daddr), sock.dport);
    assert(!res.errno);
    return 0;
   }

  case 11:
   {
    var sock = SYSCALLS.getSocketFromFD(), message = SYSCALLS.get(), length = SYSCALLS.get(), flags = SYSCALLS.get(), dest = SYSCALLS.getSocketAddress(true);
    if (!dest) {
     return FS.write(sock.stream, HEAP8, message, length);
    } else {
     return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port);
    }
   }

  case 12:
   {
    var sock = SYSCALLS.getSocketFromFD(), buf = SYSCALLS.get(), len = SYSCALLS.get(), flags = SYSCALLS.get(), addr = SYSCALLS.get(), addrlen = SYSCALLS.get();
    var msg = sock.sock_ops.recvmsg(sock, len);
    if (!msg) return 0;
    if (addr) {
     var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port);
     assert(!res.errno);
    }
    HEAPU8.set(msg.buffer, buf);
    return msg.buffer.byteLength;
   }

  case 13:
   {
    var sock = SYSCALLS.getSocketFromFD();
    sock.sock_ops.close(sock);
    return 0;
   }

  case 14:
   {
    return -ERRNO_CODES.ENOPROTOOPT;
   }

  case 15:
   {
    var sock = SYSCALLS.getSocketFromFD(), level = SYSCALLS.get(), optname = SYSCALLS.get(), optval = SYSCALLS.get(), optlen = SYSCALLS.get();
    if (level === 1) {
     if (optname === 4) {
      HEAP32[optval >> 2] = sock.error;
      HEAP32[optlen >> 2] = 4;
      sock.error = null;
      return 0;
     }
    }
    return -ERRNO_CODES.ENOPROTOOPT;
   }

  case 16:
   {
    var sock = SYSCALLS.getSocketFromFD(), message = SYSCALLS.get(), flags = SYSCALLS.get();
    var iov = HEAP32[message + 8 >> 2];
    var num = HEAP32[message + 12 >> 2];
    var addr, port;
    var name = HEAP32[message >> 2];
    var namelen = HEAP32[message + 4 >> 2];
    if (name) {
     var info = __read_sockaddr(name, namelen);
     if (info.errno) return -info.errno;
     port = info.port;
     addr = DNS.lookup_addr(info.addr) || info.addr;
    }
    var total = 0;
    for (var i = 0; i < num; i++) {
     total += HEAP32[iov + (8 * i + 4) >> 2];
    }
    var view = new Uint8Array(total);
    var offset = 0;
    for (var i = 0; i < num; i++) {
     var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
     var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
     for (var j = 0; j < iovlen; j++) {
      view[offset++] = HEAP8[iovbase + j >> 0];
     }
    }
    return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port);
   }

  case 17:
   {
    var sock = SYSCALLS.getSocketFromFD(), message = SYSCALLS.get(), flags = SYSCALLS.get();
    var iov = HEAP32[message + 8 >> 2];
    var num = HEAP32[message + 12 >> 2];
    var total = 0;
    for (var i = 0; i < num; i++) {
     total += HEAP32[iov + (8 * i + 4) >> 2];
    }
    var msg = sock.sock_ops.recvmsg(sock, total);
    if (!msg) return 0;
    var name = HEAP32[message >> 2];
    if (name) {
     var res = __write_sockaddr(name, sock.family, DNS.lookup_name(msg.addr), msg.port);
     assert(!res.errno);
    }
    var bytesRead = 0;
    var bytesRemaining = msg.buffer.byteLength;
    for (var i = 0; bytesRemaining > 0 && i < num; i++) {
     var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
     var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
     if (!iovlen) {
      continue;
     }
     var length = Math.min(iovlen, bytesRemaining);
     var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
     HEAPU8.set(buf, iovbase + bytesRead);
     bytesRead += length;
     bytesRemaining -= length;
    }
    return bytesRead;
   }

  default:
   abort("unsupported socketcall syscall " + call);
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall118(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall122(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var buf = SYSCALLS.get();
  if (!buf) return -ERRNO_CODES.EFAULT;
  var layout = {
   "sysname": 0,
   "nodename": 65,
   "domainname": 325,
   "machine": 260,
   "version": 195,
   "release": 130,
   "__size__": 390
  };
  var copyString = function(element, value) {
   var offset = layout[element];
   writeAsciiToMemory(value, buf + offset);
  };
  copyString("sysname", "Emscripten");
  copyString("nodename", "emscripten");
  copyString("release", "1.0");
  copyString("version", "#1");
  copyString("machine", "x86-JS");
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall140(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
  if (!(offset_high == -1 && offset_low < 0) && !(offset_high == 0 && offset_low >= 0)) {
   return -ERRNO_CODES.EOVERFLOW;
  }
  var offset = offset_low;
  FS.llseek(stream, offset, whence);
  tempI64 = [ stream.position >>> 0, (tempDouble = stream.position, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[result >> 2] = tempI64[0], HEAP32[result + 4 >> 2] = tempI64[1];
  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall142(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var nfds = SYSCALLS.get(), readfds = SYSCALLS.get(), writefds = SYSCALLS.get(), exceptfds = SYSCALLS.get(), timeout = SYSCALLS.get();
  assert(nfds <= 64, "nfds must be less than or equal to 64");
  assert(!exceptfds, "exceptfds not supported");
  var total = 0;
  var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0, srcReadHigh = readfds ? HEAP32[readfds + 4 >> 2] : 0;
  var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0, srcWriteHigh = writefds ? HEAP32[writefds + 4 >> 2] : 0;
  var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0, srcExceptHigh = exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0;
  var dstReadLow = 0, dstReadHigh = 0;
  var dstWriteLow = 0, dstWriteHigh = 0;
  var dstExceptLow = 0, dstExceptHigh = 0;
  var allLow = (readfds ? HEAP32[readfds >> 2] : 0) | (writefds ? HEAP32[writefds >> 2] : 0) | (exceptfds ? HEAP32[exceptfds >> 2] : 0);
  var allHigh = (readfds ? HEAP32[readfds + 4 >> 2] : 0) | (writefds ? HEAP32[writefds + 4 >> 2] : 0) | (exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0);
  var check = function(fd, low, high, val) {
   return fd < 32 ? low & val : high & val;
  };
  for (var fd = 0; fd < nfds; fd++) {
   var mask = 1 << fd % 32;
   if (!check(fd, allLow, allHigh, mask)) {
    continue;
   }
   var stream = FS.getStream(fd);
   if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
   var flags = SYSCALLS.DEFAULT_POLLMASK;
   if (stream.stream_ops.poll) {
    flags = stream.stream_ops.poll(stream);
   }
   if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
    fd < 32 ? dstReadLow = dstReadLow | mask : dstReadHigh = dstReadHigh | mask;
    total++;
   }
   if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
    fd < 32 ? dstWriteLow = dstWriteLow | mask : dstWriteHigh = dstWriteHigh | mask;
    total++;
   }
   if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
    fd < 32 ? dstExceptLow = dstExceptLow | mask : dstExceptHigh = dstExceptHigh | mask;
    total++;
   }
  }
  if (readfds) {
   HEAP32[readfds >> 2] = dstReadLow;
   HEAP32[readfds + 4 >> 2] = dstReadHigh;
  }
  if (writefds) {
   HEAP32[writefds >> 2] = dstWriteLow;
   HEAP32[writefds + 4 >> 2] = dstWriteHigh;
  }
  if (exceptfds) {
   HEAP32[exceptfds >> 2] = dstExceptLow;
   HEAP32[exceptfds + 4 >> 2] = dstExceptHigh;
  }
  return total;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall145(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doReadv(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doWritev(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall148(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall15(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), mode = SYSCALLS.get();
  FS.chmod(path, mode);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall192(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var addr = SYSCALLS.get(), len = SYSCALLS.get(), prot = SYSCALLS.get(), flags = SYSCALLS.get(), fd = SYSCALLS.get(), off = SYSCALLS.get();
  off <<= 12;
  var ptr;
  var allocated = false;
  if (fd === -1) {
   ptr = _memalign(PAGE_SIZE, len);
   if (!ptr) return -ERRNO_CODES.ENOMEM;
   _memset(ptr, 0, len);
   allocated = true;
  } else {
   var info = FS.getStream(fd);
   if (!info) return -ERRNO_CODES.EBADF;
   var res = FS.mmap(info, HEAPU8, addr, len, off, prot, flags);
   ptr = res.ptr;
   allocated = res.allocated;
  }
  SYSCALLS.mappings[ptr] = {
   malloc: ptr,
   len: len,
   allocated: allocated,
   fd: fd,
   flags: flags
  };
  return ptr;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall194(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var fd = SYSCALLS.get(), zero = SYSCALLS.getZero(), length = SYSCALLS.get64();
  FS.ftruncate(fd, length);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall195(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
  return SYSCALLS.doStat(FS.stat, path, buf);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall220(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), dirp = SYSCALLS.get(), count = SYSCALLS.get();
  if (!stream.getdents) {
   stream.getdents = FS.readdir(stream.path);
  }
  var pos = 0;
  while (stream.getdents.length > 0 && pos + 280 <= count) {
   var id;
   var type;
   var name = stream.getdents.pop();
   if (name[0] === ".") {
    id = 1;
    type = 4;
   } else {
    var child = FS.lookupNode(stream.node, name);
    id = child.id;
    type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8;
   }
   tempI64 = [ id >>> 0, (tempDouble = id, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
   HEAP32[dirp + pos >> 2] = tempI64[0], HEAP32[dirp + pos + 4 >> 2] = tempI64[1];
   tempI64 = [ stream.position >>> 0, (tempDouble = stream.position, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
   HEAP32[dirp + pos + 8 >> 2] = tempI64[0], HEAP32[dirp + pos + 12 >> 2] = tempI64[1];
   HEAP16[dirp + pos + 16 >> 1] = 280;
   HEAP8[dirp + pos + 18 >> 0] = type;
   stringToUTF8(name, dirp + pos + 19, 256);
   pos += 280;
  }
  return pos;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall221(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
  switch (cmd) {
  case 0:
   {
    var arg = SYSCALLS.get();
    if (arg < 0) {
     return -ERRNO_CODES.EINVAL;
    }
    var newStream;
    newStream = FS.open(stream.path, stream.flags, 0, arg);
    return newStream.fd;
   }

  case 1:
  case 2:
   return 0;

  case 3:
   return stream.flags;

  case 4:
   {
    var arg = SYSCALLS.get();
    stream.flags |= arg;
    return 0;
   }

  case 12:
   {
    var arg = SYSCALLS.get();
    var offset = 0;
    HEAP16[arg + offset >> 1] = 2;
    return 0;
   }

  case 13:
  case 14:
   return 0;

  case 16:
  case 8:
   return -ERRNO_CODES.EINVAL;

  case 9:
   ___setErrNo(ERRNO_CODES.EINVAL);
   return -1;

  default:
   {
    return -ERRNO_CODES.EINVAL;
   }
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall3(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.read(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall33(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), amode = SYSCALLS.get();
  return SYSCALLS.doAccess(path, amode);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall38(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var old_path = SYSCALLS.getStr(), new_path = SYSCALLS.getStr();
  FS.rename(old_path, new_path);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall39(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), mode = SYSCALLS.get();
  return SYSCALLS.doMkdir(path, mode);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall4(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.write(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall40(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr();
  FS.rmdir(path);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall5(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get();
  var stream = FS.open(pathname, flags, mode);
  return stream.fd;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall54(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
  switch (op) {
  case 21509:
  case 21505:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21510:
  case 21511:
  case 21512:
  case 21506:
  case 21507:
  case 21508:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21519:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    var argp = SYSCALLS.get();
    HEAP32[argp >> 2] = 0;
    return 0;
   }

  case 21520:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return -ERRNO_CODES.EINVAL;
   }

  case 21531:
   {
    var argp = SYSCALLS.get();
    return FS.ioctl(stream, op, argp);
   }

  case 21523:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21524:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  default:
   abort("bad ioctl syscall " + op);
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall6(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  FS.close(stream);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall91(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var addr = SYSCALLS.get(), len = SYSCALLS.get();
  var info = SYSCALLS.mappings[addr];
  if (!info) return 0;
  if (len === info.len) {
   var stream = FS.getStream(info.fd);
   SYSCALLS.doMsync(addr, stream, len, info.flags);
   FS.munmap(stream);
   SYSCALLS.mappings[addr] = null;
   if (info.allocated) {
    _free(info.malloc);
   }
  }
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___unlock() {}

function _abort() {
 Module["abort"]();
}

function _emscripten_set_main_loop_timing(mode, value) {
 Browser.mainLoop.timingMode = mode;
 Browser.mainLoop.timingValue = value;
 if (!Browser.mainLoop.func) {
  console.error("emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.");
  return 1;
 }
 if (mode == 0) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
   var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
   setTimeout(Browser.mainLoop.runner, timeUntilNextTick);
  };
  Browser.mainLoop.method = "timeout";
 } else if (mode == 1) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
   Browser.requestAnimationFrame(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "rAF";
 } else if (mode == 2) {
  if (typeof setImmediate === "undefined") {
   var setImmediates = [];
   var emscriptenMainLoopMessageId = "setimmediate";
   var Browser_setImmediate_messageHandler = function(event) {
    if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
     event.stopPropagation();
     setImmediates.shift()();
    }
   };
   addEventListener("message", Browser_setImmediate_messageHandler, true);
   setImmediate = function Browser_emulated_setImmediate(func) {
    setImmediates.push(func);
    if (ENVIRONMENT_IS_WORKER) {
     if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
     Module["setImmediates"].push(func);
     postMessage({
      target: emscriptenMainLoopMessageId
     });
    } else postMessage(emscriptenMainLoopMessageId, "*");
   };
  }
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
   setImmediate(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "immediate";
 }
 return 0;
}

function _emscripten_get_now() {
 abort();
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
 Module["noExitRuntime"] = true;
 assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
 Browser.mainLoop.func = func;
 Browser.mainLoop.arg = arg;
 var browserIterationFunc;
 if (typeof arg !== "undefined") {
  browserIterationFunc = function() {
   Module["dynCall_vi"](func, arg);
  };
 } else {
  browserIterationFunc = function() {
   Module["dynCall_v"](func);
  };
 }
 var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
 Browser.mainLoop.runner = function Browser_mainLoop_runner() {
  if (ABORT) return;
  if (Browser.mainLoop.queue.length > 0) {
   var start = Date.now();
   var blocker = Browser.mainLoop.queue.shift();
   blocker.func(blocker.arg);
   if (Browser.mainLoop.remainingBlockers) {
    var remaining = Browser.mainLoop.remainingBlockers;
    var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
    if (blocker.counted) {
     Browser.mainLoop.remainingBlockers = next;
    } else {
     next = next + .5;
     Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
    }
   }
   console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
   Browser.mainLoop.updateStatus();
   if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
   setTimeout(Browser.mainLoop.runner, 0);
   return;
  }
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
  if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
   Browser.mainLoop.scheduler();
   return;
  } else if (Browser.mainLoop.timingMode == 0) {
   Browser.mainLoop.tickStartTime = _emscripten_get_now();
  }
  if (Browser.mainLoop.method === "timeout" && Module.ctx) {
   err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
   Browser.mainLoop.method = "";
  }
  Browser.mainLoop.runIter(browserIterationFunc);
  checkStackCookie();
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  Browser.mainLoop.scheduler();
 };
 if (!noSetTiming) {
  if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps); else _emscripten_set_main_loop_timing(1, 1);
  Browser.mainLoop.scheduler();
 }
 if (simulateInfiniteLoop) {
  throw "SimulateInfiniteLoop";
 }
}

var Browser = {
 mainLoop: {
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  pause: function() {
   Browser.mainLoop.scheduler = null;
   Browser.mainLoop.currentlyRunningMainloop++;
  },
  resume: function() {
   Browser.mainLoop.currentlyRunningMainloop++;
   var timingMode = Browser.mainLoop.timingMode;
   var timingValue = Browser.mainLoop.timingValue;
   var func = Browser.mainLoop.func;
   Browser.mainLoop.func = null;
   _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
   _emscripten_set_main_loop_timing(timingMode, timingValue);
   Browser.mainLoop.scheduler();
  },
  updateStatus: function() {
   if (Module["setStatus"]) {
    var message = Module["statusMessage"] || "Please wait...";
    var remaining = Browser.mainLoop.remainingBlockers;
    var expected = Browser.mainLoop.expectedBlockers;
    if (remaining) {
     if (remaining < expected) {
      Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
     } else {
      Module["setStatus"](message);
     }
    } else {
     Module["setStatus"]("");
    }
   }
  },
  runIter: function(func) {
   if (ABORT) return;
   if (Module["preMainLoop"]) {
    var preRet = Module["preMainLoop"]();
    if (preRet === false) {
     return;
    }
   }
   try {
    func();
   } catch (e) {
    if (e instanceof ExitStatus) {
     return;
    } else {
     if (e && typeof e === "object" && e.stack) err("exception thrown: " + [ e, e.stack ]);
     throw e;
    }
   }
   if (Module["postMainLoop"]) Module["postMainLoop"]();
  }
 },
 isFullscreen: false,
 pointerLock: false,
 moduleContextCreatedCallbacks: [],
 workers: [],
 init: function() {
  if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
  if (Browser.initted) return;
  Browser.initted = true;
  try {
   new Blob();
   Browser.hasBlobConstructor = true;
  } catch (e) {
   Browser.hasBlobConstructor = false;
   console.log("warning: no blob constructor, cannot create blobs with mimetypes");
  }
  Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
  Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
  if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
   console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
   Module.noImageDecoding = true;
  }
  var imagePlugin = {};
  imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
   return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
  };
  imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
   var b = null;
   if (Browser.hasBlobConstructor) {
    try {
     b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
     if (b.size !== byteArray.length) {
      b = new Blob([ new Uint8Array(byteArray).buffer ], {
       type: Browser.getMimetype(name)
      });
     }
    } catch (e) {
     warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
    }
   }
   if (!b) {
    var bb = new Browser.BlobBuilder();
    bb.append(new Uint8Array(byteArray).buffer);
    b = bb.getBlob();
   }
   var url = Browser.URLObject.createObjectURL(b);
   assert(typeof url == "string", "createObjectURL must return a url as a string");
   var img = new Image();
   img.onload = function img_onload() {
    assert(img.complete, "Image " + name + " could not be decoded");
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    Module["preloadedImages"][name] = canvas;
    Browser.URLObject.revokeObjectURL(url);
    if (onload) onload(byteArray);
   };
   img.onerror = function img_onerror(event) {
    console.log("Image " + url + " could not be decoded");
    if (onerror) onerror();
   };
   img.src = url;
  };
  Module["preloadPlugins"].push(imagePlugin);
  var audioPlugin = {};
  audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
   return !Module.noAudioDecoding && name.substr(-4) in {
    ".ogg": 1,
    ".wav": 1,
    ".mp3": 1
   };
  };
  audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
   var done = false;
   function finish(audio) {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = audio;
    if (onload) onload(byteArray);
   }
   function fail() {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = new Audio();
    if (onerror) onerror();
   }
   if (Browser.hasBlobConstructor) {
    try {
     var b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
    } catch (e) {
     return fail();
    }
    var url = Browser.URLObject.createObjectURL(b);
    assert(typeof url == "string", "createObjectURL must return a url as a string");
    var audio = new Audio();
    audio.addEventListener("canplaythrough", function() {
     finish(audio);
    }, false);
    audio.onerror = function audio_onerror(event) {
     if (done) return;
     console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
     function encode64(data) {
      var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var PAD = "=";
      var ret = "";
      var leftchar = 0;
      var leftbits = 0;
      for (var i = 0; i < data.length; i++) {
       leftchar = leftchar << 8 | data[i];
       leftbits += 8;
       while (leftbits >= 6) {
        var curr = leftchar >> leftbits - 6 & 63;
        leftbits -= 6;
        ret += BASE[curr];
       }
      }
      if (leftbits == 2) {
       ret += BASE[(leftchar & 3) << 4];
       ret += PAD + PAD;
      } else if (leftbits == 4) {
       ret += BASE[(leftchar & 15) << 2];
       ret += PAD;
      }
      return ret;
     }
     audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
     finish(audio);
    };
    audio.src = url;
    Browser.safeSetTimeout(function() {
     finish(audio);
    }, 1e4);
   } else {
    return fail();
   }
  };
  Module["preloadPlugins"].push(audioPlugin);
  function pointerLockChange() {
   Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"];
  }
  var canvas = Module["canvas"];
  if (canvas) {
   canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function() {};
   canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function() {};
   canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
   document.addEventListener("pointerlockchange", pointerLockChange, false);
   document.addEventListener("mozpointerlockchange", pointerLockChange, false);
   document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
   document.addEventListener("mspointerlockchange", pointerLockChange, false);
   if (Module["elementPointerLock"]) {
    canvas.addEventListener("click", function(ev) {
     if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
      Module["canvas"].requestPointerLock();
      ev.preventDefault();
     }
    }, false);
   }
  }
 },
 createContext: function(canvas, useWebGL, setInModule, webGLContextAttributes) {
  if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
  var ctx;
  var contextHandle;
  if (useWebGL) {
   var contextAttributes = {
    antialias: false,
    alpha: false,
    majorVersion: typeof WebGL2RenderingContext !== "undefined" ? 2 : 1
   };
   if (webGLContextAttributes) {
    for (var attribute in webGLContextAttributes) {
     contextAttributes[attribute] = webGLContextAttributes[attribute];
    }
   }
   if (typeof GL !== "undefined") {
    contextHandle = GL.createContext(canvas, contextAttributes);
    if (contextHandle) {
     ctx = GL.getContext(contextHandle).GLctx;
    }
   }
  } else {
   ctx = canvas.getContext("2d");
  }
  if (!ctx) return null;
  if (setInModule) {
   if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
   Module.ctx = ctx;
   if (useWebGL) GL.makeContextCurrent(contextHandle);
   Module.useWebGL = useWebGL;
   Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
    callback();
   });
   Browser.init();
  }
  return ctx;
 },
 destroyContext: function(canvas, useWebGL, setInModule) {},
 fullscreenHandlersInstalled: false,
 lockPointer: undefined,
 resizeCanvas: undefined,
 requestFullscreen: function(lockPointer, resizeCanvas, vrDevice) {
  Browser.lockPointer = lockPointer;
  Browser.resizeCanvas = resizeCanvas;
  Browser.vrDevice = vrDevice;
  if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
  if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
  if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
  var canvas = Module["canvas"];
  function fullscreenChange() {
   Browser.isFullscreen = false;
   var canvasContainer = canvas.parentNode;
   if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
    canvas.exitFullscreen = Browser.exitFullscreen;
    if (Browser.lockPointer) canvas.requestPointerLock();
    Browser.isFullscreen = true;
    if (Browser.resizeCanvas) {
     Browser.setFullscreenCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   } else {
    canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
    canvasContainer.parentNode.removeChild(canvasContainer);
    if (Browser.resizeCanvas) {
     Browser.setWindowedCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   }
   if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
   if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen);
  }
  if (!Browser.fullscreenHandlersInstalled) {
   Browser.fullscreenHandlersInstalled = true;
   document.addEventListener("fullscreenchange", fullscreenChange, false);
   document.addEventListener("mozfullscreenchange", fullscreenChange, false);
   document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
   document.addEventListener("MSFullscreenChange", fullscreenChange, false);
  }
  var canvasContainer = document.createElement("div");
  canvas.parentNode.insertBefore(canvasContainer, canvas);
  canvasContainer.appendChild(canvas);
  canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function() {
   canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null) || (canvasContainer["webkitRequestFullScreen"] ? function() {
   canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null);
  if (vrDevice) {
   canvasContainer.requestFullscreen({
    vrDisplay: vrDevice
   });
  } else {
   canvasContainer.requestFullscreen();
  }
 },
 requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
  err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
  Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
   return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
  };
  return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
 },
 exitFullscreen: function() {
  if (!Browser.isFullscreen) {
   return false;
  }
  var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function() {};
  CFS.apply(document, []);
  return true;
 },
 nextRAF: 0,
 fakeRequestAnimationFrame: function(func) {
  var now = Date.now();
  if (Browser.nextRAF === 0) {
   Browser.nextRAF = now + 1e3 / 60;
  } else {
   while (now + 2 >= Browser.nextRAF) {
    Browser.nextRAF += 1e3 / 60;
   }
  }
  var delay = Math.max(Browser.nextRAF - now, 0);
  setTimeout(func, delay);
 },
 requestAnimationFrame: function requestAnimationFrame(func) {
  if (typeof window === "undefined") {
   Browser.fakeRequestAnimationFrame(func);
  } else {
   if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
   }
   window.requestAnimationFrame(func);
  }
 },
 safeCallback: function(func) {
  return function() {
   if (!ABORT) return func.apply(null, arguments);
  };
 },
 allowAsyncCallbacks: true,
 queuedAsyncCallbacks: [],
 pauseAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = false;
 },
 resumeAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = true;
  if (Browser.queuedAsyncCallbacks.length > 0) {
   var callbacks = Browser.queuedAsyncCallbacks;
   Browser.queuedAsyncCallbacks = [];
   callbacks.forEach(function(func) {
    func();
   });
  }
 },
 safeRequestAnimationFrame: function(func) {
  return Browser.requestAnimationFrame(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  });
 },
 safeSetTimeout: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setTimeout(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  }, timeout);
 },
 safeSetInterval: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setInterval(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   }
  }, timeout);
 },
 getMimetype: function(name) {
  return {
   "jpg": "image/jpeg",
   "jpeg": "image/jpeg",
   "png": "image/png",
   "bmp": "image/bmp",
   "ogg": "audio/ogg",
   "wav": "audio/wav",
   "mp3": "audio/mpeg"
  }[name.substr(name.lastIndexOf(".") + 1)];
 },
 getUserMedia: function(func) {
  if (!window.getUserMedia) {
   window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
  }
  window.getUserMedia(func);
 },
 getMovementX: function(event) {
  return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
 },
 getMovementY: function(event) {
  return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
 },
 getMouseWheelDelta: function(event) {
  var delta = 0;
  switch (event.type) {
  case "DOMMouseScroll":
   delta = event.detail / 3;
   break;

  case "mousewheel":
   delta = event.wheelDelta / 120;
   break;

  case "wheel":
   delta = event.deltaY;
   switch (event.deltaMode) {
   case 0:
    delta /= 100;
    break;

   case 1:
    delta /= 3;
    break;

   case 2:
    delta *= 80;
    break;

   default:
    throw "unrecognized mouse wheel delta mode: " + event.deltaMode;
   }
   break;

  default:
   throw "unrecognized mouse wheel event: " + event.type;
  }
  return delta;
 },
 mouseX: 0,
 mouseY: 0,
 mouseMovementX: 0,
 mouseMovementY: 0,
 touches: {},
 lastTouches: {},
 calculateMouseEvent: function(event) {
  if (Browser.pointerLock) {
   if (event.type != "mousemove" && "mozMovementX" in event) {
    Browser.mouseMovementX = Browser.mouseMovementY = 0;
   } else {
    Browser.mouseMovementX = Browser.getMovementX(event);
    Browser.mouseMovementY = Browser.getMovementY(event);
   }
   if (typeof SDL != "undefined") {
    Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
    Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
   } else {
    Browser.mouseX += Browser.mouseMovementX;
    Browser.mouseY += Browser.mouseMovementY;
   }
  } else {
   var rect = Module["canvas"].getBoundingClientRect();
   var cw = Module["canvas"].width;
   var ch = Module["canvas"].height;
   var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
   var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
   assert(typeof scrollX !== "undefined" && typeof scrollY !== "undefined", "Unable to retrieve scroll position, mouse positions likely broken.");
   if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
    var touch = event.touch;
    if (touch === undefined) {
     return;
    }
    var adjustedX = touch.pageX - (scrollX + rect.left);
    var adjustedY = touch.pageY - (scrollY + rect.top);
    adjustedX = adjustedX * (cw / rect.width);
    adjustedY = adjustedY * (ch / rect.height);
    var coords = {
     x: adjustedX,
     y: adjustedY
    };
    if (event.type === "touchstart") {
     Browser.lastTouches[touch.identifier] = coords;
     Browser.touches[touch.identifier] = coords;
    } else if (event.type === "touchend" || event.type === "touchmove") {
     var last = Browser.touches[touch.identifier];
     if (!last) last = coords;
     Browser.lastTouches[touch.identifier] = last;
     Browser.touches[touch.identifier] = coords;
    }
    return;
   }
   var x = event.pageX - (scrollX + rect.left);
   var y = event.pageY - (scrollY + rect.top);
   x = x * (cw / rect.width);
   y = y * (ch / rect.height);
   Browser.mouseMovementX = x - Browser.mouseX;
   Browser.mouseMovementY = y - Browser.mouseY;
   Browser.mouseX = x;
   Browser.mouseY = y;
  }
 },
 asyncLoad: function(url, onload, onerror, noRunDep) {
  var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
  Module["readAsync"](url, function(arrayBuffer) {
   assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
   onload(new Uint8Array(arrayBuffer));
   if (dep) removeRunDependency(dep);
  }, function(event) {
   if (onerror) {
    onerror();
   } else {
    throw 'Loading data file "' + url + '" failed.';
   }
  });
  if (dep) addRunDependency(dep);
 },
 resizeListeners: [],
 updateResizeListeners: function() {
  var canvas = Module["canvas"];
  Browser.resizeListeners.forEach(function(listener) {
   listener(canvas.width, canvas.height);
  });
 },
 setCanvasSize: function(width, height, noUpdates) {
  var canvas = Module["canvas"];
  Browser.updateCanvasDimensions(canvas, width, height);
  if (!noUpdates) Browser.updateResizeListeners();
 },
 windowedWidth: 0,
 windowedHeight: 0,
 setFullscreenCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags | 8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 setWindowedCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags & ~8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 updateCanvasDimensions: function(canvas, wNative, hNative) {
  if (wNative && hNative) {
   canvas.widthNative = wNative;
   canvas.heightNative = hNative;
  } else {
   wNative = canvas.widthNative;
   hNative = canvas.heightNative;
  }
  var w = wNative;
  var h = hNative;
  if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
   if (w / h < Module["forcedAspectRatio"]) {
    w = Math.round(h * Module["forcedAspectRatio"]);
   } else {
    h = Math.round(w / Module["forcedAspectRatio"]);
   }
  }
  if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
   var factor = Math.min(screen.width / w, screen.height / h);
   w = Math.round(w * factor);
   h = Math.round(h * factor);
  }
  if (Browser.resizeCanvas) {
   if (canvas.width != w) canvas.width = w;
   if (canvas.height != h) canvas.height = h;
   if (typeof canvas.style != "undefined") {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
   }
  } else {
   if (canvas.width != wNative) canvas.width = wNative;
   if (canvas.height != hNative) canvas.height = hNative;
   if (typeof canvas.style != "undefined") {
    if (w != wNative || h != hNative) {
     canvas.style.setProperty("width", w + "px", "important");
     canvas.style.setProperty("height", h + "px", "important");
    } else {
     canvas.style.removeProperty("width");
     canvas.style.removeProperty("height");
    }
   }
  }
 },
 wgetRequests: {},
 nextWgetRequestHandle: 0,
 getNextWgetRequestHandle: function() {
  var handle = Browser.nextWgetRequestHandle;
  Browser.nextWgetRequestHandle++;
  return handle;
 }
};

var AL = {
 QUEUE_INTERVAL: 25,
 QUEUE_LOOKAHEAD: .1,
 DEVICE_NAME: "Emscripten OpenAL",
 CAPTURE_DEVICE_NAME: "Emscripten OpenAL capture",
 ALC_EXTENSIONS: {
  ALC_SOFT_pause_device: true,
  ALC_SOFT_HRTF: true
 },
 AL_EXTENSIONS: {
  AL_EXT_float32: true,
  AL_SOFT_loop_points: true,
  AL_SOFT_source_length: true,
  AL_EXT_source_distance_model: true,
  AL_SOFT_source_spatialize: true
 },
 _alcErr: 0,
 alcErr: 0,
 deviceRefCounts: {},
 alcStringCache: {},
 paused: false,
 stringCache: {},
 contexts: {},
 currentCtx: null,
 buffers: {
  0: {
   id: 0,
   refCount: 0,
   audioBuf: null,
   frequency: 0,
   bytesPerSample: 2,
   channels: 1,
   length: 0
  }
 },
 paramArray: [],
 _nextId: 1,
 newId: function() {
  return AL.freeIds.length > 0 ? AL.freeIds.pop() : AL._nextId++;
 },
 freeIds: [],
 scheduleContextAudio: function(ctx) {
  if (Browser.mainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
   return;
  }
  for (var i in ctx.sources) {
   AL.scheduleSourceAudio(ctx.sources[i]);
  }
 },
 scheduleSourceAudio: function(src, lookahead) {
  if (Browser.mainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
   return;
  }
  if (src.state !== 4114) {
   return;
  }
  var currentTime = AL.updateSourceTime(src);
  var startTime = src.bufStartTime;
  var startOffset = src.bufOffset;
  var bufCursor = src.bufsProcessed;
  for (var i = 0; i < src.audioQueue.length; i++) {
   var audioSrc = src.audioQueue[i];
   startTime = audioSrc._startTime + audioSrc._duration;
   startOffset = 0;
   bufCursor += audioSrc._skipCount + 1;
  }
  if (!lookahead) {
   lookahead = AL.QUEUE_LOOKAHEAD;
  }
  var lookaheadTime = currentTime + lookahead;
  var skipCount = 0;
  while (startTime < lookaheadTime) {
   if (bufCursor >= src.bufQueue.length) {
    if (src.looping) {
     bufCursor %= src.bufQueue.length;
    } else {
     break;
    }
   }
   var buf = src.bufQueue[bufCursor % src.bufQueue.length];
   if (buf.length === 0) {
    skipCount++;
    if (skipCount === src.bufQueue.length) {
     break;
    }
   } else {
    var audioSrc = src.context.audioCtx.createBufferSource();
    audioSrc.buffer = buf.audioBuf;
    audioSrc.playbackRate.value = src.playbackRate;
    if (buf.audioBuf._loopStart || buf.audioBuf._loopEnd) {
     audioSrc.loopStart = buf.audioBuf._loopStart;
     audioSrc.loopEnd = buf.audioBuf._loopEnd;
    }
    var duration = 0;
    if (src.type === 4136 && src.looping) {
     duration = Number.POSITIVE_INFINITY;
     audioSrc.loop = true;
     if (buf.audioBuf._loopStart) {
      audioSrc.loopStart = buf.audioBuf._loopStart;
     }
     if (buf.audioBuf._loopEnd) {
      audioSrc.loopEnd = buf.audioBuf._loopEnd;
     }
    } else {
     duration = (buf.audioBuf.duration - startOffset) / src.playbackRate;
    }
    audioSrc._startOffset = startOffset;
    audioSrc._duration = duration;
    audioSrc._skipCount = skipCount;
    skipCount = 0;
    audioSrc.connect(src.gain);
    if (typeof audioSrc.start !== "undefined") {
     startTime = Math.max(startTime, src.context.audioCtx.currentTime);
     audioSrc.start(startTime, startOffset);
    } else if (typeof audioSrc.noteOn !== "undefined") {
     startTime = Math.max(startTime, src.context.audioCtx.currentTime);
     audioSrc.noteOn(startTime);
    }
    audioSrc._startTime = startTime;
    src.audioQueue.push(audioSrc);
    startTime += duration;
   }
   startOffset = 0;
   bufCursor++;
  }
 },
 updateSourceTime: function(src) {
  var currentTime = src.context.audioCtx.currentTime;
  if (src.state !== 4114) {
   return currentTime;
  }
  if (!isFinite(src.bufStartTime)) {
   src.bufStartTime = currentTime - src.bufOffset / src.playbackRate;
   src.bufOffset = 0;
  }
  var nextStartTime = 0;
  while (src.audioQueue.length) {
   var audioSrc = src.audioQueue[0];
   src.bufsProcessed += audioSrc._skipCount;
   nextStartTime = audioSrc._startTime + audioSrc._duration;
   if (currentTime < nextStartTime) {
    break;
   }
   src.audioQueue.shift();
   src.bufStartTime = nextStartTime;
   src.bufOffset = 0;
   src.bufsProcessed++;
  }
  if (src.bufsProcessed >= src.bufQueue.length && !src.looping) {
   AL.setSourceState(src, 4116);
  } else if (src.type === 4136 && src.looping) {
   var buf = src.bufQueue[0];
   if (buf.length === 0) {
    src.bufOffset = 0;
   } else {
    var delta = (currentTime - src.bufStartTime) * src.playbackRate;
    var loopStart = buf.audioBuf._loopStart || 0;
    var loopEnd = buf.audioBuf._loopEnd || buf.audioBuf.duration;
    if (loopEnd <= loopStart) {
     loopEnd = buf.audioBuf.duration;
    }
    if (delta < loopEnd) {
     src.bufOffset = delta;
    } else {
     src.bufOffset = loopStart + (delta - loopStart) % (loopEnd - loopStart);
    }
   }
  } else if (src.audioQueue[0]) {
   src.bufOffset = (currentTime - src.audioQueue[0]._startTime) * src.playbackRate;
  } else {
   if (src.type !== 4136 && src.looping) {
    var srcDuration = AL.sourceDuration(src) / src.playbackRate;
    if (srcDuration > 0) {
     src.bufStartTime += Math.floor((currentTime - src.bufStartTime) / srcDuration) * srcDuration;
    }
   }
   for (var i = 0; i < src.bufQueue.length; i++) {
    if (src.bufsProcessed >= src.bufQueue.length) {
     if (src.looping) {
      src.bufsProcessed %= src.bufQueue.length;
     } else {
      AL.setSourceState(src, 4116);
      break;
     }
    }
    var buf = src.bufQueue[src.bufsProcessed];
    if (buf.length > 0) {
     nextStartTime = src.bufStartTime + buf.audioBuf.duration / src.playbackRate;
     if (currentTime < nextStartTime) {
      src.bufOffset = (currentTime - src.bufStartTime) * src.playbackRate;
      break;
     }
     src.bufStartTime = nextStartTime;
    }
    src.bufOffset = 0;
    src.bufsProcessed++;
   }
  }
  return currentTime;
 },
 cancelPendingSourceAudio: function(src) {
  AL.updateSourceTime(src);
  for (var i = 1; i < src.audioQueue.length; i++) {
   var audioSrc = src.audioQueue[i];
   audioSrc.stop();
  }
  if (src.audioQueue.length > 1) {
   src.audioQueue.length = 1;
  }
 },
 stopSourceAudio: function(src) {
  for (var i = 0; i < src.audioQueue.length; i++) {
   src.audioQueue[i].stop();
  }
  src.audioQueue.length = 0;
 },
 setSourceState: function(src, state) {
  if (state === 4114) {
   if (src.state === 4114 || src.state == 4116) {
    src.bufsProcessed = 0;
    src.bufOffset = 0;
   } else {}
   AL.stopSourceAudio(src);
   src.state = 4114;
   src.bufStartTime = Number.NEGATIVE_INFINITY;
   AL.scheduleSourceAudio(src);
  } else if (state === 4115) {
   if (src.state === 4114) {
    AL.updateSourceTime(src);
    AL.stopSourceAudio(src);
    src.state = 4115;
   }
  } else if (state === 4116) {
   if (src.state !== 4113) {
    src.state = 4116;
    src.bufsProcessed = src.bufQueue.length;
    src.bufStartTime = Number.NEGATIVE_INFINITY;
    src.bufOffset = 0;
    AL.stopSourceAudio(src);
   }
  } else if (state === 4113) {
   if (src.state !== 4113) {
    src.state = 4113;
    src.bufsProcessed = 0;
    src.bufStartTime = Number.NEGATIVE_INFINITY;
    src.bufOffset = 0;
    AL.stopSourceAudio(src);
   }
  }
 },
 initSourcePanner: function(src) {
  if (src.type === 4144) {
   return;
  }
  var templateBuf = AL.buffers[0];
  for (var i = 0; i < src.bufQueue.length; i++) {
   if (src.bufQueue[i].id !== 0) {
    templateBuf = src.bufQueue[i];
    break;
   }
  }
  if (src.spatialize === 1 || src.spatialize === 2 && templateBuf.channels === 1) {
   if (src.panner) {
    return;
   }
   src.panner = src.context.audioCtx.createPanner();
   AL.updateSourceGlobal(src);
   AL.updateSourceSpace(src);
   src.panner.connect(src.context.gain);
   src.gain.disconnect();
   src.gain.connect(src.panner);
  } else {
   if (!src.panner) {
    return;
   }
   src.panner.disconnect();
   src.gain.disconnect();
   src.gain.connect(src.context.gain);
   src.panner = null;
  }
 },
 updateContextGlobal: function(ctx) {
  for (var i in ctx.sources) {
   AL.updateSourceGlobal(ctx.sources[i]);
  }
 },
 updateSourceGlobal: function(src) {
  var panner = src.panner;
  if (!panner) {
   return;
  }
  panner.refDistance = src.refDistance;
  panner.maxDistance = src.maxDistance;
  panner.rolloffFactor = src.rolloffFactor;
  panner.panningModel = src.context.hrtf ? "HRTF" : "equalpower";
  var distanceModel = src.context.sourceDistanceModel ? src.distanceModel : src.context.distanceModel;
  switch (distanceModel) {
  case 0:
   panner.distanceModel = "inverse";
   panner.refDistance = 3.40282e38;
   break;

  case 53249:
  case 53250:
   panner.distanceModel = "inverse";
   break;

  case 53251:
  case 53252:
   panner.distanceModel = "linear";
   break;

  case 53253:
  case 53254:
   panner.distanceModel = "exponential";
   break;
  }
 },
 updateListenerSpace: function(ctx) {
  var listener = ctx.audioCtx.listener;
  if (listener.positionX) {
   listener.positionX.value = ctx.listener.position[0];
   listener.positionY.value = ctx.listener.position[1];
   listener.positionZ.value = ctx.listener.position[2];
  } else {
   listener.setPosition(ctx.listener.position[0], ctx.listener.position[1], ctx.listener.position[2]);
  }
  if (listener.forwardX) {
   listener.forwardX.value = ctx.listener.direction[0];
   listener.forwardY.value = ctx.listener.direction[1];
   listener.forwardZ.value = ctx.listener.direction[2];
   listener.upX.value = ctx.listener.up[0];
   listener.upY.value = ctx.listener.up[1];
   listener.upZ.value = ctx.listener.up[2];
  } else {
   listener.setOrientation(ctx.listener.direction[0], ctx.listener.direction[1], ctx.listener.direction[2], ctx.listener.up[0], ctx.listener.up[1], ctx.listener.up[2]);
  }
  for (var i in ctx.sources) {
   AL.updateSourceSpace(ctx.sources[i]);
  }
 },
 updateSourceSpace: function(src) {
  if (!src.panner) {
   return;
  }
  var panner = src.panner;
  var posX = src.position[0];
  var posY = src.position[1];
  var posZ = src.position[2];
  var dirX = src.direction[0];
  var dirY = src.direction[1];
  var dirZ = src.direction[2];
  var listener = src.context.listener;
  var lPosX = listener.position[0];
  var lPosY = listener.position[1];
  var lPosZ = listener.position[2];
  if (src.relative) {
   var lBackX = -listener.direction[0];
   var lBackY = -listener.direction[1];
   var lBackZ = -listener.direction[2];
   var lUpX = listener.up[0];
   var lUpY = listener.up[1];
   var lUpZ = listener.up[2];
   var inverseMagnitude = function(x, y, z) {
    var length = Math.sqrt(x * x + y * y + z * z);
    if (length < Number.EPSILON) {
     return 0;
    }
    return 1 / length;
   };
   var invMag = inverseMagnitude(lBackX, lBackY, lBackZ);
   lBackX *= invMag;
   lBackY *= invMag;
   lBackZ *= invMag;
   invMag = inverseMagnitude(lUpX, lUpY, lUpZ);
   lUpX *= invMag;
   lUpY *= invMag;
   lUpZ *= invMag;
   var lRightX = lUpY * lBackZ - lUpZ * lBackY;
   var lRightY = lUpZ * lBackX - lUpX * lBackZ;
   var lRightZ = lUpX * lBackY - lUpY * lBackX;
   invMag = inverseMagnitude(lRightX, lRightY, lRightZ);
   lRightX *= invMag;
   lRightY *= invMag;
   lRightZ *= invMag;
   lUpX = lBackY * lRightZ - lBackZ * lRightY;
   lUpY = lBackZ * lRightX - lBackX * lRightZ;
   lUpZ = lBackX * lRightY - lBackY * lRightX;
   var oldX = dirX;
   var oldY = dirY;
   var oldZ = dirZ;
   dirX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
   dirY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
   dirZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
   oldX = posX;
   oldY = posY;
   oldZ = posZ;
   posX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
   posY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
   posZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
   posX += lPosX;
   posY += lPosY;
   posZ += lPosZ;
  }
  if (panner.positionX) {
   panner.positionX.value = posX;
   panner.positionY.value = posY;
   panner.positionZ.value = posZ;
  } else {
   panner.setPosition(posX, posY, posZ);
  }
  if (panner.orientationX) {
   panner.orientationX.value = dirX;
   panner.orientationY.value = dirY;
   panner.orientationZ.value = dirZ;
  } else {
   panner.setOrientation(dirX, dirY, dirZ);
  }
  var oldShift = src.dopplerShift;
  var velX = src.velocity[0];
  var velY = src.velocity[1];
  var velZ = src.velocity[2];
  var lVelX = listener.velocity[0];
  var lVelY = listener.velocity[1];
  var lVelZ = listener.velocity[2];
  if (posX === lPosX && posY === lPosY && posZ === lPosZ || velX === lVelX && velY === lVelY && velZ === lVelZ) {
   src.dopplerShift = 1;
  } else {
   var speedOfSound = src.context.speedOfSound;
   var dopplerFactor = src.context.dopplerFactor;
   var slX = lPosX - posX;
   var slY = lPosY - posY;
   var slZ = lPosZ - posZ;
   var magSl = Math.sqrt(slX * slX + slY * slY + slZ * slZ);
   var vls = (slX * lVelX + slY * lVelY + slZ * lVelZ) / magSl;
   var vss = (slX * velX + slY * velY + slZ * velZ) / magSl;
   vls = Math.min(vls, speedOfSound / dopplerFactor);
   vss = Math.min(vss, speedOfSound / dopplerFactor);
   src.dopplerShift = (speedOfSound - dopplerFactor * vls) / (speedOfSound - dopplerFactor * vss);
  }
  if (src.dopplerShift !== oldShift) {
   AL.updateSourceRate(src);
  }
 },
 updateSourceRate: function(src) {
  if (src.state === 4114) {
   AL.cancelPendingSourceAudio(src);
   var audioSrc = src.audioQueue[0];
   if (!audioSrc) {
    return;
   }
   var duration;
   if (src.type === 4136 && src.looping) {
    duration = Number.POSITIVE_INFINITY;
   } else {
    duration = (audioSrc.buffer.duration - audioSrc._startOffset) / src.playbackRate;
   }
   audioSrc._duration = duration;
   audioSrc.playbackRate.value = src.playbackRate;
   AL.scheduleSourceAudio(src);
  }
 },
 sourceDuration: function(src) {
  var length = 0;
  for (var i = 0; i < src.bufQueue.length; i++) {
   var audioBuf = src.bufQueue[i].audioBuf;
   length += audioBuf ? audioBuf.duration : 0;
  }
  return length;
 },
 sourceTell: function(src) {
  AL.updateSourceTime(src);
  var offset = 0;
  for (var i = 0; i < src.bufsProcessed; i++) {
   offset += src.bufQueue[i].audioBuf.duration;
  }
  offset += src.bufOffset;
  return offset;
 },
 sourceSeek: function(src, offset) {
  var playing = src.state == 4114;
  if (playing) {
   AL.setSourceState(src, 4113);
  }
  if (src.bufQueue[src.bufsProcessed].audioBuf !== null) {
   src.bufsProcessed = 0;
   while (offset > src.bufQueue[src.bufsProcessed].audioBuf.duration) {
    offset -= src.bufQueue[src.bufsProcessed].audiobuf.duration;
    src.bufsProcessed++;
   }
   src.bufOffset = offset;
  }
  if (playing) {
   AL.setSourceState(src, 4114);
  }
 },
 getGlobalParam: function(funcname, param) {
  if (!AL.currentCtx) {
   return null;
  }
  switch (param) {
  case 49152:
   return AL.currentCtx.dopplerFactor;

  case 49155:
   return AL.currentCtx.speedOfSound;

  case 53248:
   return AL.currentCtx.distanceModel;

  default:
   AL.currentCtx.err = 40962;
   return null;
  }
 },
 setGlobalParam: function(funcname, param, value) {
  if (!AL.currentCtx) {
   return;
  }
  switch (param) {
  case 49152:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.currentCtx.dopplerFactor = value;
   AL.updateListenerSpace(AL.currentCtx);
   break;

  case 49155:
   if (!Number.isFinite(value) || value <= 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.currentCtx.speedOfSound = value;
   AL.updateListenerSpace(AL.currentCtx);
   break;

  case 53248:
   switch (value) {
   case 0:
   case 53249:
   case 53250:
   case 53251:
   case 53252:
   case 53253:
   case 53254:
    AL.currentCtx.distanceModel = value;
    AL.updateContextGlobal(AL.currentCtx);
    break;

   default:
    AL.currentCtx.err = 40963;
    return;
   }
   break;

  default:
   AL.currentCtx.err = 40962;
   return;
  }
 },
 getListenerParam: function(funcname, param) {
  if (!AL.currentCtx) {
   return null;
  }
  switch (param) {
  case 4100:
   return AL.currentCtx.listener.position;

  case 4102:
   return AL.currentCtx.listener.velocity;

  case 4111:
   return AL.currentCtx.listener.direction.concat(AL.currentCtx.listener.up);

  case 4106:
   return AL.currentCtx.gain.gain.value;

  default:
   AL.currentCtx.err = 40962;
   return null;
  }
 },
 setListenerParam: function(funcname, param, value) {
  if (!AL.currentCtx) {
   return;
  }
  if (value === null) {
   AL.currentCtx.err = 40962;
   return;
  }
  var listener = AL.currentCtx.listener;
  switch (param) {
  case 4100:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
    AL.currentCtx.err = 40963;
    return;
   }
   listener.position[0] = value[0];
   listener.position[1] = value[1];
   listener.position[2] = value[2];
   AL.updateListenerSpace(AL.currentCtx);
   break;

  case 4102:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
    AL.currentCtx.err = 40963;
    return;
   }
   listener.velocity[0] = value[0];
   listener.velocity[1] = value[1];
   listener.velocity[2] = value[2];
   AL.updateListenerSpace(AL.currentCtx);
   break;

  case 4106:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.currentCtx.gain.gain.value = value;
   break;

  case 4111:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2]) || !Number.isFinite(value[3]) || !Number.isFinite(value[4]) || !Number.isFinite(value[5])) {
    AL.currentCtx.err = 40963;
    return;
   }
   listener.direction[0] = value[0];
   listener.direction[1] = value[1];
   listener.direction[2] = value[2];
   listener.up[0] = value[3];
   listener.up[1] = value[4];
   listener.up[2] = value[5];
   AL.updateListenerSpace(AL.currentCtx);
   break;

  default:
   AL.currentCtx.err = 40962;
   return;
  }
 },
 getBufferParam: function(funcname, bufferId, param) {
  if (!AL.currentCtx) {
   return;
  }
  var buf = AL.buffers[bufferId];
  if (!buf || bufferId === 0) {
   AL.currentCtx.err = 40961;
   return;
  }
  switch (param) {
  case 8193:
   return buf.frequency;

  case 8194:
   return buf.bytesPerSample * 8;

  case 8195:
   return buf.channels;

  case 8196:
   return buf.length * buf.bytesPerSample * buf.channels;

  case 8213:
   if (buf.length === 0) {
    return [ 0, 0 ];
   } else {
    return [ (buf.audioBuf._loopStart || 0) * buf.frequency, (buf.audioBuf._loopEnd || buf.length) * buf.frequency ];
   }

  default:
   AL.currentCtx.err = 40962;
   return null;
  }
 },
 setBufferParam: function(funcname, bufferId, param, value) {
  if (!AL.currentCtx) {
   return;
  }
  var buf = AL.buffers[bufferId];
  if (!buf || bufferId === 0) {
   AL.currentCtx.err = 40961;
   return;
  }
  if (value === null) {
   AL.currentCtx.err = 40962;
   return;
  }
  switch (param) {
  case 8196:
   if (value !== 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   break;

  case 8213:
   if (value[0] < 0 || value[0] > buf.length || value[1] < 0 || value[1] > buf.Length || value[0] >= value[1]) {
    AL.currentCtx.err = 40963;
    return;
   }
   if (buf.refCount > 0) {
    AL.currentCtx.err = 40964;
    return;
   }
   if (buf.audioBuf) {
    buf.audioBuf._loopStart = value[0] / buf.frequency;
    buf.audioBuf._loopEnd = value[1] / buf.frequency;
   }
   break;

  default:
   AL.currentCtx.err = 40962;
   return;
  }
 },
 getSourceParam: function(funcname, sourceId, param) {
  if (!AL.currentCtx) {
   return null;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
   AL.currentCtx.err = 40961;
   return null;
  }
  switch (param) {
  case 514:
   return src.relative;

  case 4097:
   return src.coneInnerAngle;

  case 4098:
   return src.coneOuterAngle;

  case 4099:
   return src.pitch;

  case 4100:
   return src.position;

  case 4101:
   return src.direction;

  case 4102:
   return src.velocity;

  case 4103:
   return src.looping;

  case 4105:
   if (src.type === 4136) {
    return src.bufQueue[0].id;
   } else {
    return 0;
   }

  case 4106:
   return src.gain.gain.value;

  case 4109:
   return src.minGain;

  case 4110:
   return src.maxGain;

  case 4112:
   return src.state;

  case 4117:
   if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
    return 0;
   } else {
    return src.bufQueue.length;
   }

  case 4118:
   if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0 || src.looping) {
    return 0;
   } else {
    return src.bufsProcessed;
   }

  case 4128:
   return src.refDistance;

  case 4129:
   return src.rolloffFactor;

  case 4130:
   return src.coneOuterGain;

  case 4131:
   return src.maxDistance;

  case 4132:
   return AL.sourceTell(src);

  case 4133:
   var offset = AL.sourceTell(src);
   if (offset > 0) {
    offset *= src.bufQueue[0].frequency;
   }
   return offset;

  case 4134:
   var offset = AL.sourceTell(src);
   if (offset > 0) {
    offset *= src.bufQueue[0].frequency * src.bufQueue[0].bytesPerSample;
   }
   return offset;

  case 4135:
   return src.type;

  case 4628:
   return src.spatialize;

  case 8201:
   var length = 0;
   var bytesPerFrame = 0;
   for (var i = 0; i < src.bufQueue.length; i++) {
    length += src.bufQueue[i].length;
    if (src.bufQueue[i].id !== 0) {
     bytesPerFrame = src.bufQueue[i].bytesPerSample * src.bufQueue[i].channels;
    }
   }
   return length * bytesPerFrame;

  case 8202:
   var length = 0;
   for (var i = 0; i < src.bufQueue.length; i++) {
    length += src.bufQueue[i].length;
   }
   return length;

  case 8203:
   return AL.sourceDuration(src);

  case 53248:
   return src.distanceModel;

  default:
   AL.currentCtx.err = 40962;
   return null;
  }
 },
 setSourceParam: function(funcname, sourceId, param, value) {
  if (!AL.currentCtx) {
   return;
  }
  var src = AL.currentCtx.sources[sourceId];
  if (!src) {
   AL.currentCtx.err = 40961;
   return;
  }
  if (value === null) {
   AL.currentCtx.err = 40962;
   return;
  }
  switch (param) {
  case 514:
   if (value === 1) {
    src.relative = true;
    AL.updateSourceSpace(src);
   } else if (value === 0) {
    src.relative = false;
    AL.updateSourceSpace(src);
   } else {
    AL.currentCtx.err = 40963;
    return;
   }
   break;

  case 4097:
   if (!Number.isFinite(value)) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.coneInnerAngle = value;
   if (src.panner) {
    src.panner.coneInnerAngle = value % 360;
   }
   break;

  case 4098:
   if (!Number.isFinite(value)) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.coneOuterAngle = value;
   if (src.panner) {
    src.panner.coneOuterAngle = value % 360;
   }
   break;

  case 4099:
   if (!Number.isFinite(value) || value <= 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   if (src.pitch === value) {
    break;
   }
   src.pitch = value;
   AL.updateSourceRate(src);
   break;

  case 4100:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.position[0] = value[0];
   src.position[1] = value[1];
   src.position[2] = value[2];
   AL.updateSourceSpace(src);
   break;

  case 4101:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.direction[0] = value[0];
   src.direction[1] = value[1];
   src.direction[2] = value[2];
   AL.updateSourceSpace(src);
   break;

  case 4102:
   if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.velocity[0] = value[0];
   src.velocity[1] = value[1];
   src.velocity[2] = value[2];
   AL.updateSourceSpace(src);
   break;

  case 4103:
   if (value === 1) {
    src.looping = true;
    AL.updateSourceTime(src);
    if (src.type === 4136 && src.audioQueue.length > 0) {
     var audioSrc = src.audioQueue[0];
     audioSrc.loop = true;
     audioSrc._duration = Number.POSITIVE_INFINITY;
    }
   } else if (value === 0) {
    src.looping = false;
    var currentTime = AL.updateSourceTime(src);
    if (src.type === 4136 && src.audioQueue.length > 0) {
     var audioSrc = src.audioQueue[0];
     audioSrc.loop = false;
     audioSrc._duration = src.bufQueue[0].audioBuf.duration / src.playbackRate;
     audioSrc._startTime = currentTime - src.bufOffset / src.playbackRate;
    }
   } else {
    AL.currentCtx.err = 40963;
    return;
   }
   break;

  case 4105:
   if (src.state === 4114 || src.state === 4115) {
    AL.currentCtx.err = 40964;
    return;
   }
   if (value === 0) {
    for (var i in src.bufQueue) {
     src.bufQueue[i].refCount--;
    }
    src.bufQueue.length = 1;
    src.bufQueue[0] = AL.buffers[0];
    src.bufsProcessed = 0;
    src.type = 4144;
   } else {
    var buf = AL.buffers[value];
    if (!buf) {
     AL.currentCtx.err = 40963;
     return;
    }
    for (var i in src.bufQueue) {
     src.bufQueue[i].refCount--;
    }
    src.bufQueue.length = 0;
    buf.refCount++;
    src.bufQueue = [ buf ];
    src.bufsProcessed = 0;
    src.type = 4136;
   }
   AL.initSourcePanner(src);
   AL.scheduleSourceAudio(src);
   break;

  case 4106:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.gain.gain.value = value;
   break;

  case 4109:
   if (!Number.isFinite(value) || value < 0 || value > Math.min(src.maxGain, 1)) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.minGain = value;
   break;

  case 4110:
   if (!Number.isFinite(value) || value < Math.max(0, src.minGain) || value > 1) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.maxGain = value;
   break;

  case 4128:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.refDistance = value;
   if (src.panner) {
    src.panner.refDistance = value;
   }
   break;

  case 4129:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.rolloffFactor = value;
   if (src.panner) {
    src.panner.rolloffFactor = value;
   }
   break;

  case 4130:
   if (!Number.isFinite(value) || value < 0 || value > 1) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.coneOuterGain = value;
   if (src.panner) {
    src.panner.coneOuterGain = value;
   }
   break;

  case 4131:
   if (!Number.isFinite(value) || value < 0) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.maxDistance = value;
   if (src.panner) {
    src.panner.maxDistance = value;
   }
   break;

  case 4132:
   if (value < 0 || value > AL.sourceDuration(src)) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.sourceSeek(src, value);
   break;

  case 4133:
   var srcLen = AL.sourceDuration(src);
   if (srcLen > 0) {
    var frequency;
    for (var bufId in src.bufQueue) {
     if (bufId !== 0) {
      frequency = src.bufQueue[bufId].frequency;
      break;
     }
    }
    value /= frequency;
   }
   if (value < 0 || value > srcLen) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.sourceSeek(src, value);
   break;

  case 4134:
   var srcLen = AL.sourceDuration(src);
   if (srcLen > 0) {
    var bytesPerSec;
    for (var bufId in src.bufQueue) {
     if (bufId !== 0) {
      var buf = src.bufQueue[bufId];
      bytesPerSec = buf.frequency * buf.bytesPerSample * buf.channels;
      break;
     }
    }
    value /= bytesPerSec;
   }
   if (value < 0 || value > srcLen) {
    AL.currentCtx.err = 40963;
    return;
   }
   AL.sourceSeek(src, value);
   break;

  case 4628:
   if (value !== 0 && value !== 1 && value !== 2) {
    AL.currentCtx.err = 40963;
    return;
   }
   src.spatialize = value;
   AL.initSourcePanner(src);
   break;

  case 8201:
  case 8202:
  case 8203:
   AL.currentCtx.err = 40964;
   break;

  case 53248:
   switch (value) {
   case 0:
   case 53249:
   case 53250:
   case 53251:
   case 53252:
   case 53253:
   case 53254:
    src.distanceModel = value;
    if (AL.currentCtx.sourceDistanceModel) {
     AL.updateContextGlobal(AL.currentCtx);
    }
    break;

   default:
    AL.currentCtx.err = 40963;
    return;
   }
   break;

  default:
   AL.currentCtx.err = 40962;
   return;
  }
 },
 captures: {},
 sharedCaptureAudioCtx: null,
 requireValidCaptureDevice: function(deviceId, funcname) {
  if (deviceId === 0) {
   AL.alcErr = 40961;
   return null;
  }
  var c = AL.captures[deviceId];
  if (!c) {
   AL.alcErr = 40961;
   return null;
  }
  var err = c.mediaStreamError;
  if (err) {
   AL.alcErr = 40961;
   return null;
  }
  return c;
 }
};

function _alBufferData(bufferId, format, pData, size, freq) {
 if (!AL.currentCtx) {
  return;
 }
 var buf = AL.buffers[bufferId];
 if (!buf) {
  AL.currentCtx.err = 40963;
  return;
 }
 if (freq <= 0) {
  AL.currentCtx.err = 40963;
  return;
 }
 var audioBuf = null;
 try {
  switch (format) {
  case 4352:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size, freq);
    var channel0 = audioBuf.getChannelData(0);
    for (var i = 0; i < size; ++i) {
     channel0[i] = HEAPU8[pData++] * .0078125 - 1;
    }
   }
   buf.bytesPerSample = 1;
   buf.channels = 1;
   buf.length = size;
   break;

  case 4353:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 1, freq);
    var channel0 = audioBuf.getChannelData(0);
    pData >>= 1;
    for (var i = 0; i < size >> 1; ++i) {
     channel0[i] = HEAP16[pData++] * 30517578125e-15;
    }
   }
   buf.bytesPerSample = 2;
   buf.channels = 1;
   buf.length = size >> 1;
   break;

  case 4354:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 1, freq);
    var channel0 = audioBuf.getChannelData(0);
    var channel1 = audioBuf.getChannelData(1);
    for (var i = 0; i < size >> 1; ++i) {
     channel0[i] = HEAPU8[pData++] * .0078125 - 1;
     channel1[i] = HEAPU8[pData++] * .0078125 - 1;
    }
   }
   buf.bytesPerSample = 1;
   buf.channels = 2;
   buf.length = size >> 1;
   break;

  case 4355:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 2, freq);
    var channel0 = audioBuf.getChannelData(0);
    var channel1 = audioBuf.getChannelData(1);
    pData >>= 1;
    for (var i = 0; i < size >> 2; ++i) {
     channel0[i] = HEAP16[pData++] * 30517578125e-15;
     channel1[i] = HEAP16[pData++] * 30517578125e-15;
    }
   }
   buf.bytesPerSample = 2;
   buf.channels = 2;
   buf.length = size >> 2;
   break;

  case 65552:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 2, freq);
    var channel0 = audioBuf.getChannelData(0);
    pData >>= 2;
    for (var i = 0; i < size >> 2; ++i) {
     channel0[i] = HEAPF32[pData++];
    }
   }
   buf.bytesPerSample = 4;
   buf.channels = 1;
   buf.length = size >> 2;
   break;

  case 65553:
   if (size > 0) {
    audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 3, freq);
    var channel0 = audioBuf.getChannelData(0);
    var channel1 = audioBuf.getChannelData(1);
    pData >>= 2;
    for (var i = 0; i < size >> 3; ++i) {
     channel0[i] = HEAPF32[pData++];
     channel1[i] = HEAPF32[pData++];
    }
   }
   buf.bytesPerSample = 4;
   buf.channels = 2;
   buf.length = size >> 3;
   break;

  default:
   AL.currentCtx.err = 40963;
   return;
  }
  buf.frequency = freq;
  buf.audioBuf = audioBuf;
 } catch (e) {
  AL.currentCtx.err = 40963;
  return;
 }
}

function _alDeleteBuffers(count, pBufferIds) {
 if (!AL.currentCtx) {
  return;
 }
 for (var i = 0; i < count; ++i) {
  var bufId = HEAP32[pBufferIds + i * 4 >> 2];
  if (bufId === 0) {
   continue;
  }
  if (!AL.buffers[bufId]) {
   AL.currentCtx.err = 40961;
   return;
  }
  if (AL.buffers[bufId].refCount) {
   AL.currentCtx.err = 40964;
   return;
  }
 }
 for (var i = 0; i < count; ++i) {
  var bufId = HEAP32[pBufferIds + i * 4 >> 2];
  if (bufId === 0) {
   continue;
  }
  AL.deviceRefCounts[AL.buffers[bufId].deviceId]--;
  delete AL.buffers[bufId];
  AL.freeIds.push(bufId);
 }
}

function _alSourcei(sourceId, param, value) {
 switch (param) {
 case 514:
 case 4097:
 case 4098:
 case 4103:
 case 4105:
 case 4128:
 case 4129:
 case 4131:
 case 4132:
 case 4133:
 case 4134:
 case 4628:
 case 8201:
 case 8202:
 case 53248:
  AL.setSourceParam("alSourcei", sourceId, param, value);
  break;

 default:
  AL.setSourceParam("alSourcei", sourceId, param, null);
  break;
 }
}

function _alDeleteSources(count, pSourceIds) {
 if (!AL.currentCtx) {
  return;
 }
 for (var i = 0; i < count; ++i) {
  var srcId = HEAP32[pSourceIds + i * 4 >> 2];
  if (!AL.currentCtx.sources[srcId]) {
   AL.currentCtx.err = 40961;
   return;
  }
 }
 for (var i = 0; i < count; ++i) {
  var srcId = HEAP32[pSourceIds + i * 4 >> 2];
  AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
  _alSourcei(srcId, 4105, 0);
  delete AL.currentCtx.sources[srcId];
  AL.freeIds.push(srcId);
 }
}

function _alDistanceModel(model) {
 AL.setGlobalParam("alDistanceModel", 53248, model);
}

function _alGenBuffers(count, pBufferIds) {
 if (!AL.currentCtx) {
  return;
 }
 for (var i = 0; i < count; ++i) {
  var buf = {
   deviceId: AL.currentCtx.deviceId,
   id: AL.newId(),
   refCount: 0,
   audioBuf: null,
   frequency: 0,
   bytesPerSample: 2,
   channels: 1,
   length: 0
  };
  AL.deviceRefCounts[buf.deviceId]++;
  AL.buffers[buf.id] = buf;
  HEAP32[pBufferIds + i * 4 >> 2] = buf.id;
 }
}

function _alGenSources(count, pSourceIds) {
 if (!AL.currentCtx) {
  return;
 }
 for (var i = 0; i < count; ++i) {
  var gain = AL.currentCtx.audioCtx.createGain();
  gain.connect(AL.currentCtx.gain);
  var src = {
   context: AL.currentCtx,
   id: AL.newId(),
   type: 4144,
   state: 4113,
   bufQueue: [ AL.buffers[0] ],
   audioQueue: [],
   looping: false,
   pitch: 1,
   dopplerShift: 1,
   gain: gain,
   minGain: 0,
   maxGain: 1,
   panner: null,
   bufsProcessed: 0,
   bufStartTime: Number.NEGATIVE_INFINITY,
   bufOffset: 0,
   relative: false,
   refDistance: 1,
   maxDistance: 3.40282e38,
   rolloffFactor: 1,
   position: [ 0, 0, 0 ],
   velocity: [ 0, 0, 0 ],
   direction: [ 0, 0, 0 ],
   coneOuterGain: 0,
   coneInnerAngle: 360,
   coneOuterAngle: 360,
   distanceModel: 53250,
   spatialize: 2,
   get playbackRate() {
    return this.pitch * this.dopplerShift;
   }
  };
  AL.currentCtx.sources[src.id] = src;
  HEAP32[pSourceIds + i * 4 >> 2] = src.id;
 }
}

function _alGetError() {
 if (!AL.currentCtx) {
  return 40964;
 } else {
  var err = AL.currentCtx.err;
  AL.currentCtx.err = 0;
  return err;
 }
}

function _alGetSourcei(sourceId, param, pValue) {
 var val = AL.getSourceParam("alGetSourcei", sourceId, param);
 if (val === null) {
  return;
 }
 if (!pValue) {
  AL.currentCtx.err = 40963;
  return;
 }
 switch (param) {
 case 514:
 case 4097:
 case 4098:
 case 4103:
 case 4105:
 case 4112:
 case 4117:
 case 4118:
 case 4128:
 case 4129:
 case 4131:
 case 4132:
 case 4133:
 case 4134:
 case 4135:
 case 4628:
 case 8201:
 case 8202:
 case 53248:
  HEAP32[pValue >> 2] = val;
  break;

 default:
  AL.currentCtx.err = 40962;
  return;
 }
}

function _alGetString(param) {
 if (!AL.currentCtx) {
  return 0;
 }
 if (AL.stringCache[param]) {
  return AL.stringCache[param];
 }
 var ret;
 switch (param) {
 case 0:
  ret = "No Error";
  break;

 case 40961:
  ret = "Invalid Name";
  break;

 case 40962:
  ret = "Invalid Enum";
  break;

 case 40963:
  ret = "Invalid Value";
  break;

 case 40964:
  ret = "Invalid Operation";
  break;

 case 40965:
  ret = "Out of Memory";
  break;

 case 45057:
  ret = "Emscripten";
  break;

 case 45058:
  ret = "1.1";
  break;

 case 45059:
  ret = "WebAudio";
  break;

 case 45060:
  ret = "";
  for (var ext in AL.AL_EXTENSIONS) {
   ret = ret.concat(ext);
   ret = ret.concat(" ");
  }
  ret = ret.trim();
  break;

 default:
  AL.currentCtx.err = 40962;
  return 0;
 }
 ret = allocate(intArrayFromString(ret), "i8", ALLOC_NORMAL);
 AL.stringCache[param] = ret;
 return ret;
}

function _alSourcePause(sourceId) {
 if (!AL.currentCtx) {
  return;
 }
 var src = AL.currentCtx.sources[sourceId];
 if (!src) {
  AL.currentCtx.err = 40961;
  return;
 }
 AL.setSourceState(src, 4115);
}

function _alSourcePlay(sourceId) {
 if (!AL.currentCtx) {
  return;
 }
 var src = AL.currentCtx.sources[sourceId];
 if (!src) {
  AL.currentCtx.err = 40961;
  return;
 }
 AL.setSourceState(src, 4114);
}

function _alSourceQueueBuffers(sourceId, count, pBufferIds) {
 if (!AL.currentCtx) {
  return;
 }
 var src = AL.currentCtx.sources[sourceId];
 if (!src) {
  AL.currentCtx.err = 40961;
  return;
 }
 if (src.type === 4136) {
  AL.currentCtx.err = 40964;
  return;
 }
 if (count === 0) {
  return;
 }
 var templateBuf = AL.buffers[0];
 for (var i = 0; i < src.bufQueue.length; i++) {
  if (src.bufQueue[i].id !== 0) {
   templateBuf = src.bufQueue[i];
   break;
  }
 }
 for (var i = 0; i < count; ++i) {
  var bufId = HEAP32[pBufferIds + i * 4 >> 2];
  var buf = AL.buffers[bufId];
  if (!buf) {
   AL.currentCtx.err = 40961;
   return;
  }
  if (templateBuf.id !== 0 && (buf.frequency !== templateBuf.frequency || buf.bytesPerSample !== templateBuf.bytesPerSample || buf.channels !== templateBuf.channels)) {
   AL.currentCtx.err = 40964;
  }
 }
 if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
  src.bufQueue.length = 0;
 }
 src.type = 4137;
 for (var i = 0; i < count; ++i) {
  var bufId = HEAP32[pBufferIds + i * 4 >> 2];
  var buf = AL.buffers[bufId];
  buf.refCount++;
  src.bufQueue.push(buf);
 }
 if (src.looping) {
  AL.cancelPendingSourceAudio(src);
 }
 AL.initSourcePanner(src);
 AL.scheduleSourceAudio(src);
}

function _alSourceStop(sourceId) {
 if (!AL.currentCtx) {
  return;
 }
 var src = AL.currentCtx.sources[sourceId];
 if (!src) {
  AL.currentCtx.err = 40961;
  return;
 }
 AL.setSourceState(src, 4116);
}

function _alSourceUnqueueBuffers(sourceId, count, pBufferIds) {
 if (!AL.currentCtx) {
  return;
 }
 var src = AL.currentCtx.sources[sourceId];
 if (!src) {
  AL.currentCtx.err = 40961;
  return;
 }
 if (count > (src.bufQueue.length === 1 && src.bufQueue[0].id === 0 ? 0 : src.bufsProcessed)) {
  AL.currentCtx.err = 40963;
  return;
 }
 if (count === 0) {
  return;
 }
 for (var i = 0; i < count; i++) {
  var buf = src.bufQueue.shift();
  buf.refCount--;
  HEAP32[pBufferIds + i * 4 >> 2] = buf.id;
  src.bufsProcessed--;
 }
 if (src.bufQueue.length === 0) {
  src.bufQueue.push(AL.buffers[0]);
 }
 AL.initSourcePanner(src);
 AL.scheduleSourceAudio(src);
}

function _alSourcef(sourceId, param, value) {
 switch (param) {
 case 4097:
 case 4098:
 case 4099:
 case 4106:
 case 4109:
 case 4110:
 case 4128:
 case 4129:
 case 4130:
 case 4131:
 case 4132:
 case 4133:
 case 4134:
 case 8203:
  AL.setSourceParam("alSourcef", sourceId, param, value);
  break;

 default:
  AL.setSourceParam("alSourcef", sourceId, param, null);
  break;
 }
}

function _alSourcefv(sourceId, param, pValues) {
 if (!AL.currentCtx) {
  return;
 }
 if (!pValues) {
  AL.currentCtx.err = 40963;
  return;
 }
 switch (param) {
 case 4097:
 case 4098:
 case 4099:
 case 4106:
 case 4109:
 case 4110:
 case 4128:
 case 4129:
 case 4130:
 case 4131:
 case 4132:
 case 4133:
 case 4134:
 case 8203:
  var val = HEAPF32[pValues >> 2];
  AL.setSourceParam("alSourcefv", sourceId, param, val);
  break;

 case 4100:
 case 4101:
 case 4102:
  AL.paramArray[0] = HEAPF32[pValues >> 2];
  AL.paramArray[1] = HEAPF32[pValues + 4 >> 2];
  AL.paramArray[2] = HEAPF32[pValues + 8 >> 2];
  AL.setSourceParam("alSourcefv", sourceId, param, AL.paramArray);
  break;

 default:
  AL.setSourceParam("alSourcefv", sourceId, param, null);
  break;
 }
}

function _alcCloseDevice(deviceId) {
 if (!(deviceId in AL.deviceRefCounts) || AL.deviceRefCounts[deviceId] > 0) {
  return 0;
 }
 delete AL.deviceRefCounts[deviceId];
 AL.freeIds.push(deviceId);
 return 1;
}

function _alcCreateContext(deviceId, pAttrList) {
 if (!(deviceId in AL.deviceRefCounts)) {
  AL.alcErr = 40961;
  return 0;
 }
 var options = null;
 var attrs = [];
 var hrtf = null;
 pAttrList >>= 2;
 if (pAttrList) {
  var attr = 0;
  var val = 0;
  while (true) {
   attr = HEAP32[pAttrList++];
   attrs.push(attr);
   if (attr === 0) {
    break;
   }
   val = HEAP32[pAttrList++];
   attrs.push(val);
   switch (attr) {
   case 4103:
    if (!options) {
     options = {};
    }
    options.sampleRate = val;
    break;

   case 4112:
   case 4113:
    break;

   case 6546:
    switch (val) {
    case 0:
     hrtf = false;
     break;

    case 1:
     hrtf = true;
     break;

    case 2:
     break;

    default:
     AL.alcErr = 40964;
     return 0;
    }
    break;

   case 6550:
    if (val !== 0) {
     AL.alcErr = 40964;
     return 0;
    }
    break;

   default:
    AL.alcErr = 40964;
    return 0;
   }
  }
 }
 var AudioContext = window.AudioContext || window.webkitAudioContext;
 var ac = null;
 try {
  if (options) {
   ac = new AudioContext(options);
  } else {
   ac = new AudioContext();
  }
 } catch (e) {
  if (e.name === "NotSupportedError") {
   AL.alcErr = 40964;
  } else {
   AL.alcErr = 40961;
  }
  return 0;
 }
 if (typeof ac.createGain === "undefined") {
  ac.createGain = ac.createGainNode;
 }
 var gain = ac.createGain();
 gain.connect(ac.destination);
 var ctx = {
  deviceId: deviceId,
  id: AL.newId(),
  attrs: attrs,
  audioCtx: ac,
  listener: {
   position: [ 0, 0, 0 ],
   velocity: [ 0, 0, 0 ],
   direction: [ 0, 0, 0 ],
   up: [ 0, 0, 0 ]
  },
  sources: [],
  interval: setInterval(function() {
   AL.scheduleContextAudio(ctx);
  }, AL.QUEUE_INTERVAL),
  gain: gain,
  distanceModel: 53250,
  speedOfSound: 343.3,
  dopplerFactor: 1,
  sourceDistanceModel: false,
  hrtf: hrtf || false,
  _err: 0,
  get err() {
   return this._err;
  },
  set err(val) {
   if (this._err === 0 || val === 0) {
    this._err = val;
   }
  }
 };
 AL.deviceRefCounts[deviceId]++;
 AL.contexts[ctx.id] = ctx;
 if (hrtf !== null) {
  for (var ctxId in AL.contexts) {
   var c = AL.contexts[ctxId];
   if (c.deviceId === deviceId) {
    c.hrtf = hrtf;
    AL.updateContextGlobal(c);
   }
  }
 }
 return ctx.id;
}

function _alcDestroyContext(contextId) {
 var ctx = AL.contexts[contextId];
 if (AL.currentCtx === ctx) {
  AL.alcErr = 40962;
  return;
 }
 if (AL.contexts[contextId].interval) {
  clearInterval(AL.contexts[contextId].interval);
 }
 AL.deviceRefCounts[ctx.deviceId]--;
 delete AL.contexts[contextId];
 AL.freeIds.push(contextId);
}

function _alcGetString(deviceId, param) {
 if (AL.alcStringCache[param]) {
  return AL.alcStringCache[param];
 }
 var ret;
 switch (param) {
 case 0:
  ret = "No Error";
  break;

 case 40961:
  ret = "Invalid Device";
  break;

 case 40962:
  ret = "Invalid Context";
  break;

 case 40963:
  ret = "Invalid Enum";
  break;

 case 40964:
  ret = "Invalid Value";
  break;

 case 40965:
  ret = "Out of Memory";
  break;

 case 4100:
  if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
   ret = AL.DEVICE_NAME;
  } else {
   return 0;
  }
  break;

 case 4101:
  if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
   ret = AL.DEVICE_NAME.concat("\0");
  } else {
   ret = "\0";
  }
  break;

 case 785:
  ret = AL.CAPTURE_DEVICE_NAME;
  break;

 case 784:
  if (deviceId === 0) ret = AL.CAPTURE_DEVICE_NAME.concat("\0"); else {
   var c = AL.requireValidCaptureDevice(deviceId, "alcGetString");
   if (!c) {
    return 0;
   }
   ret = c.deviceName;
  }
  break;

 case 4102:
  if (!deviceId) {
   AL.alcErr = 40961;
   return 0;
  }
  ret = "";
  for (var ext in AL.ALC_EXTENSIONS) {
   ret = ret.concat(ext);
   ret = ret.concat(" ");
  }
  ret = ret.trim();
  break;

 default:
  AL.alcErr = 40963;
  return 0;
 }
 ret = allocate(intArrayFromString(ret), "i8", ALLOC_NORMAL);
 AL.alcStringCache[param] = ret;
 return ret;
}

function _alcMakeContextCurrent(contextId) {
 if (contextId === 0) {
  AL.currentCtx = null;
  return 0;
 } else {
  AL.currentCtx = AL.contexts[contextId];
  return 1;
 }
}

function _alcOpenDevice(pDeviceName) {
 if (pDeviceName) {
  var name = UTF8ToString(pDeviceName);
  if (name !== AL.DEVICE_NAME) {
   return 0;
  }
 }
 if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
  var deviceId = AL.newId();
  AL.deviceRefCounts[deviceId] = 0;
  return deviceId;
 } else {
  return 0;
 }
}

function _alcProcessContext(contextId) {}

function _emscripten_get_now_is_monotonic() {
 return 0 || ENVIRONMENT_IS_NODE || typeof dateNow !== "undefined" || typeof performance === "object" && performance && typeof performance["now"] === "function";
}

function _clock_gettime(clk_id, tp) {
 var now;
 if (clk_id === 0) {
  now = Date.now();
 } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
  now = _emscripten_get_now();
 } else {
  ___setErrNo(22);
  return -1;
 }
 HEAP32[tp >> 2] = now / 1e3 | 0;
 HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
 return 0;
}

function _dlopen() {
 abort("To use dlopen, you need to use Emscripten's linking support, see https://github.com/emscripten-core/emscripten/wiki/Linking");
}

function _dlclose() {
 return _dlopen.apply(null, arguments);
}

function _dlsym() {
 return _dlopen.apply(null, arguments);
}

var EGL = {
 errorCode: 12288,
 defaultDisplayInitialized: false,
 currentContext: 0,
 currentReadSurface: 0,
 currentDrawSurface: 0,
 contextAttributes: {
  alpha: false,
  depth: false,
  stencil: false,
  antialias: false
 },
 stringCache: {},
 setErrorCode: function(code) {
  EGL.errorCode = code;
 },
 chooseConfig: function(display, attribList, config, config_size, numConfigs) {
  if (display != 62e3) {
   EGL.setErrorCode(12296);
   return 0;
  }
  if (attribList) {
   for (;;) {
    var param = HEAP32[attribList >> 2];
    if (param == 12321) {
     var alphaSize = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.alpha = alphaSize > 0;
    } else if (param == 12325) {
     var depthSize = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.depth = depthSize > 0;
    } else if (param == 12326) {
     var stencilSize = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.stencil = stencilSize > 0;
    } else if (param == 12337) {
     var samples = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.antialias = samples > 0;
    } else if (param == 12338) {
     var samples = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.antialias = samples == 1;
    } else if (param == 12544) {
     var requestedPriority = HEAP32[attribList + 4 >> 2];
     EGL.contextAttributes.lowLatency = requestedPriority != 12547;
    } else if (param == 12344) {
     break;
    }
    attribList += 8;
   }
  }
  if ((!config || !config_size) && !numConfigs) {
   EGL.setErrorCode(12300);
   return 0;
  }
  if (numConfigs) {
   HEAP32[numConfigs >> 2] = 1;
  }
  if (config && config_size > 0) {
   HEAP32[config >> 2] = 62002;
  }
  EGL.setErrorCode(12288);
  return 1;
 }
};

function _eglBindAPI(api) {
 if (api == 12448) {
  EGL.setErrorCode(12288);
  return 1;
 } else {
  EGL.setErrorCode(12300);
  return 0;
 }
}

function _eglChooseConfig(display, attrib_list, configs, config_size, numConfigs) {
 return EGL.chooseConfig(display, attrib_list, configs, config_size, numConfigs);
}

var GL = {
 debug: true,
 counter: 1,
 lastError: 0,
 buffers: [],
 mappedBuffers: {},
 programs: [],
 framebuffers: [],
 renderbuffers: [],
 textures: [],
 uniforms: [],
 shaders: [],
 vaos: [],
 contexts: {},
 currentContext: null,
 offscreenCanvases: {},
 timerQueriesEXT: [],
 queries: [],
 samplers: [],
 transformFeedbacks: [],
 syncs: [],
 programInfos: {},
 stringCache: {},
 stringiCache: {},
 unpackAlignment: 4,
 init: function() {
  GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
  for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
   GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
  }
 },
 recordError: function recordError(errorCode) {
  if (!GL.lastError) {
   GL.lastError = errorCode;
  }
 },
 getNewId: function(table) {
  var ret = GL.counter++;
  for (var i = table.length; i < ret; i++) {
   table[i] = null;
  }
  return ret;
 },
 MINI_TEMP_BUFFER_SIZE: 256,
 miniTempBuffer: null,
 miniTempBufferViews: [ 0 ],
 getSource: function(shader, count, string, length) {
  var source = "";
  for (var i = 0; i < count; ++i) {
   var len = length ? HEAP32[length + i * 4 >> 2] : -1;
   source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len);
  }
  return source;
 },
 validateGLObjectID: function(objectHandleArray, objectID, callerFunctionName, objectReadableType) {
  if (objectID != 0) {
   if (objectHandleArray[objectID] === null) {
    console.error(callerFunctionName + " called with an already deleted " + objectReadableType + " ID " + objectID + "!");
   } else if (!objectHandleArray[objectID]) {
    console.error(callerFunctionName + " called with an invalid " + objectReadableType + " ID " + objectID + "!");
   }
  }
 },
 validateVertexAttribPointer: function(dimension, dataType, stride, offset) {
  var sizeBytes = 1;
  switch (dataType) {
  case 5120:
  case 5121:
   sizeBytes = 1;
   break;

  case 5122:
  case 5123:
   sizeBytes = 2;
   break;

  case 5124:
  case 5125:
  case 5126:
   sizeBytes = 4;
   break;

  case 5130:
   sizeBytes = 8;
   break;

  default:
   if (GL.currentContext.version >= 2 && (dataType == 33640 || dataType == 36255)) {
    sizeBytes = 4;
    break;
   } else {}
   console.error("Invalid vertex attribute data type GLenum " + dataType + " passed to GL function!");
  }
  if (dimension == 32993) {
   console.error("WebGL does not support size=GL_BGRA in a call to glVertexAttribPointer! Please use size=4 and type=GL_UNSIGNED_BYTE instead!");
  } else if (dimension < 1 || dimension > 4) {
   console.error("Invalid dimension=" + dimension + " in call to glVertexAttribPointer, must be 1,2,3 or 4.");
  }
  if (stride < 0 || stride > 255) {
   console.error("Invalid stride=" + stride + " in call to glVertexAttribPointer. Note that maximum supported stride in WebGL is 255!");
  }
  if (offset % sizeBytes != 0) {
   console.error("GL spec section 6.4 error: vertex attribute data offset of " + offset + " bytes should have been a multiple of the data type size that was used: GLenum " + dataType + " has size of " + sizeBytes + " bytes!");
  }
  if (stride % sizeBytes != 0) {
   console.error("GL spec section 6.4 error: vertex attribute data stride of " + stride + " bytes should have been a multiple of the data type size that was used: GLenum " + dataType + " has size of " + sizeBytes + " bytes!");
  }
 },
 createContext: function(canvas, webGLContextAttributes) {
  var errorInfo = "?";
  function onContextCreationError(event) {
   errorInfo = event.statusMessage || errorInfo;
  }
  canvas.addEventListener("webglcontextcreationerror", onContextCreationError, false);
  if (Module["preinitializedWebGLContext"]) {
   var ctx = Module["preinitializedWebGLContext"];
   webGLContextAttributes.majorVersion = typeof WebGL2RenderingContext !== "undefined" && ctx instanceof WebGL2RenderingContext ? 2 : 1;
  } else {
   var ctx = webGLContextAttributes.majorVersion > 1 ? canvas.getContext("webgl2", webGLContextAttributes) : canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
  }
  canvas.removeEventListener("webglcontextcreationerror", onContextCreationError, false);
  if (!ctx) {
   err("Could not create canvas: " + [ errorInfo, JSON.stringify(webGLContextAttributes) ]);
  }
  return ctx && GL.registerContext(ctx, webGLContextAttributes);
 },
 registerContext: function(ctx, webGLContextAttributes) {
  var handle = _malloc(8);
  assert(handle, "malloc() failed in GL.registerContext!");
  var context = {
   handle: handle,
   attributes: webGLContextAttributes,
   version: webGLContextAttributes.majorVersion,
   GLctx: ctx
  };
  function getChromeVersion() {
   var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
   return raw ? parseInt(raw[2], 10) : false;
  }
  context.supportsWebGL2EntryPoints = context.version >= 2 && (getChromeVersion() === false || getChromeVersion() >= 58);
  if (ctx.canvas) ctx.canvas.GLctxObject = context;
  GL.contexts[handle] = context;
  if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
   GL.initExtensions(context);
  }
  if (webGLContextAttributes.renderViaOffscreenBackBuffer) err("renderViaOffscreenBackBuffer=true specified in WebGL context creation attributes, pass linker flag -s OFFSCREEN_FRAMEBUFFER=1 to enable support!");
  return handle;
 },
 makeContextCurrent: function(contextHandle) {
  if (contextHandle && !GL.contexts[contextHandle]) {
   console.error("GL.makeContextCurrent() failed! WebGL context " + contextHandle + " does not exist!");
  }
  GL.currentContext = GL.contexts[contextHandle];
  Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
  return !(contextHandle && !GLctx);
 },
 getContext: function(contextHandle) {
  return GL.contexts[contextHandle];
 },
 deleteContext: function(contextHandle) {
  if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
  if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
  if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
  _free(GL.contexts[contextHandle]);
  GL.contexts[contextHandle] = null;
 },
 initExtensions: function(context) {
  if (!context) context = GL.currentContext;
  if (context.initExtensionsDone) return;
  context.initExtensionsDone = true;
  var GLctx = context.GLctx;
  if (context.version < 2) {
   var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
   if (instancedArraysExt) {
    GLctx["vertexAttribDivisor"] = function(index, divisor) {
     instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor);
    };
    GLctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
     instancedArraysExt["drawArraysInstancedANGLE"](mode, first, count, primcount);
    };
    GLctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
     instancedArraysExt["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    };
   }
   var vaoExt = GLctx.getExtension("OES_vertex_array_object");
   if (vaoExt) {
    GLctx["createVertexArray"] = function() {
     return vaoExt["createVertexArrayOES"]();
    };
    GLctx["deleteVertexArray"] = function(vao) {
     vaoExt["deleteVertexArrayOES"](vao);
    };
    GLctx["bindVertexArray"] = function(vao) {
     vaoExt["bindVertexArrayOES"](vao);
    };
    GLctx["isVertexArray"] = function(vao) {
     return vaoExt["isVertexArrayOES"](vao);
    };
   }
   var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
   if (drawBuffersExt) {
    GLctx["drawBuffers"] = function(n, bufs) {
     drawBuffersExt["drawBuffersWEBGL"](n, bufs);
    };
   }
  }
  GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
  var automaticallyEnabledExtensions = [ "OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2" ];
  var exts = GLctx.getSupportedExtensions();
  if (exts && exts.length > 0) {
   GLctx.getSupportedExtensions().forEach(function(ext) {
    if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
     GLctx.getExtension(ext);
    }
   });
  }
 },
 populateUniformTable: function(program) {
  GL.validateGLObjectID(GL.programs, program, "populateUniformTable", "program");
  var p = GL.programs[program];
  var ptable = GL.programInfos[program] = {
   uniforms: {},
   maxUniformLength: 0,
   maxAttributeLength: -1,
   maxUniformBlockNameLength: -1
  };
  var utable = ptable.uniforms;
  var numUniforms = GLctx.getProgramParameter(p, 35718);
  for (var i = 0; i < numUniforms; ++i) {
   var u = GLctx.getActiveUniform(p, i);
   var name = u.name;
   ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
   if (name.slice(-1) == "]") {
    name = name.slice(0, name.lastIndexOf("["));
   }
   var loc = GLctx.getUniformLocation(p, name);
   if (loc) {
    var id = GL.getNewId(GL.uniforms);
    utable[name] = [ u.size, id ];
    GL.uniforms[id] = loc;
    for (var j = 1; j < u.size; ++j) {
     var n = name + "[" + j + "]";
     loc = GLctx.getUniformLocation(p, n);
     id = GL.getNewId(GL.uniforms);
     GL.uniforms[id] = loc;
    }
   }
  }
 }
};

function _eglCreateContext(display, config, hmm, contextAttribs) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 var glesContextVersion = 1;
 for (;;) {
  var param = HEAP32[contextAttribs >> 2];
  if (param == 12440) {
   glesContextVersion = HEAP32[contextAttribs + 4 >> 2];
  } else if (param == 12344) {
   break;
  } else {
   EGL.setErrorCode(12292);
   return 0;
  }
  contextAttribs += 8;
 }
 if (glesContextVersion < 2 || glesContextVersion > 3) {
  if (glesContextVersion == 3) {
   err("When initializing GLES3/WebGL2 via EGL, one must build with -s USE_WEBGL2=1 !");
  } else {
   err("When initializing GLES2/WebGL1 via EGL, one must pass EGL_CONTEXT_CLIENT_VERSION = 2 to GL context attributes! GLES version " + glesContextVersion + " is not supported!");
  }
  EGL.setErrorCode(12293);
  return 0;
 }
 EGL.contextAttributes.majorVersion = glesContextVersion - 1;
 EGL.contextAttributes.minorVersion = 0;
 EGL.context = GL.createContext(Module["canvas"], EGL.contextAttributes);
 if (EGL.context != 0) {
  EGL.setErrorCode(12288);
  GL.makeContextCurrent(EGL.context);
  Module.useWebGL = true;
  Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
   callback();
  });
  GL.makeContextCurrent(null);
  return 62004;
 } else {
  EGL.setErrorCode(12297);
  return 0;
 }
}

function _eglCreateWindowSurface(display, config, win, attrib_list) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (config != 62002) {
  EGL.setErrorCode(12293);
  return 0;
 }
 EGL.setErrorCode(12288);
 return 62006;
}

function _eglDestroyContext(display, context) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (context != 62004) {
  EGL.setErrorCode(12294);
  return 0;
 }
 EGL.setErrorCode(12288);
 return 1;
}

function _eglDestroySurface(display, surface) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (surface != 62006) {
  EGL.setErrorCode(12301);
  return 1;
 }
 if (EGL.currentReadSurface == surface) {
  EGL.currentReadSurface = 0;
 }
 if (EGL.currentDrawSurface == surface) {
  EGL.currentDrawSurface = 0;
 }
 EGL.setErrorCode(12288);
 return 1;
}

function _eglGetConfigAttrib(display, config, attribute, value) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (config != 62002) {
  EGL.setErrorCode(12293);
  return 0;
 }
 if (!value) {
  EGL.setErrorCode(12300);
  return 0;
 }
 EGL.setErrorCode(12288);
 switch (attribute) {
 case 12320:
  HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 32 : 24;
  return 1;

 case 12321:
  HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 8 : 0;
  return 1;

 case 12322:
  HEAP32[value >> 2] = 8;
  return 1;

 case 12323:
  HEAP32[value >> 2] = 8;
  return 1;

 case 12324:
  HEAP32[value >> 2] = 8;
  return 1;

 case 12325:
  HEAP32[value >> 2] = EGL.contextAttributes.depth ? 24 : 0;
  return 1;

 case 12326:
  HEAP32[value >> 2] = EGL.contextAttributes.stencil ? 8 : 0;
  return 1;

 case 12327:
  HEAP32[value >> 2] = 12344;
  return 1;

 case 12328:
  HEAP32[value >> 2] = 62002;
  return 1;

 case 12329:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12330:
  HEAP32[value >> 2] = 4096;
  return 1;

 case 12331:
  HEAP32[value >> 2] = 16777216;
  return 1;

 case 12332:
  HEAP32[value >> 2] = 4096;
  return 1;

 case 12333:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12334:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12335:
  HEAP32[value >> 2] = 12344;
  return 1;

 case 12337:
  HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 4 : 0;
  return 1;

 case 12338:
  HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 1 : 0;
  return 1;

 case 12339:
  HEAP32[value >> 2] = 4;
  return 1;

 case 12340:
  HEAP32[value >> 2] = 12344;
  return 1;

 case 12341:
 case 12342:
 case 12343:
  HEAP32[value >> 2] = -1;
  return 1;

 case 12345:
 case 12346:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12347:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12348:
  HEAP32[value >> 2] = 1;
  return 1;

 case 12349:
 case 12350:
  HEAP32[value >> 2] = 0;
  return 1;

 case 12351:
  HEAP32[value >> 2] = 12430;
  return 1;

 case 12352:
  HEAP32[value >> 2] = 4;
  return 1;

 case 12354:
  HEAP32[value >> 2] = 0;
  return 1;

 default:
  EGL.setErrorCode(12292);
  return 0;
 }
}

function _eglGetDisplay(nativeDisplayType) {
 EGL.setErrorCode(12288);
 return 62e3;
}

function _eglGetError() {
 return EGL.errorCode;
}

function _eglGetProcAddress(name_) {
 return _emscripten_GetProcAddress(name_);
}

function _eglInitialize(display, majorVersion, minorVersion) {
 if (display == 62e3) {
  if (majorVersion) {
   HEAP32[majorVersion >> 2] = 1;
  }
  if (minorVersion) {
   HEAP32[minorVersion >> 2] = 4;
  }
  EGL.defaultDisplayInitialized = true;
  EGL.setErrorCode(12288);
  return 1;
 } else {
  EGL.setErrorCode(12296);
  return 0;
 }
}

function _eglMakeCurrent(display, draw, read, context) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (context != 0 && context != 62004) {
  EGL.setErrorCode(12294);
  return 0;
 }
 if (read != 0 && read != 62006 || draw != 0 && draw != 62006) {
  EGL.setErrorCode(12301);
  return 0;
 }
 GL.makeContextCurrent(context ? EGL.context : null);
 EGL.currentContext = context;
 EGL.currentDrawSurface = draw;
 EGL.currentReadSurface = read;
 EGL.setErrorCode(12288);
 return 1;
}

function _eglQueryString(display, name) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 EGL.setErrorCode(12288);
 if (EGL.stringCache[name]) return EGL.stringCache[name];
 var ret;
 switch (name) {
 case 12371:
  ret = allocate(intArrayFromString("Emscripten"), "i8", ALLOC_NORMAL);
  break;

 case 12372:
  ret = allocate(intArrayFromString("1.4 Emscripten EGL"), "i8", ALLOC_NORMAL);
  break;

 case 12373:
  ret = allocate(intArrayFromString(""), "i8", ALLOC_NORMAL);
  break;

 case 12429:
  ret = allocate(intArrayFromString("OpenGL_ES"), "i8", ALLOC_NORMAL);
  break;

 default:
  EGL.setErrorCode(12300);
  return 0;
 }
 EGL.stringCache[name] = ret;
 return ret;
}

function _eglSwapBuffers() {
 if (!EGL.defaultDisplayInitialized) {
  EGL.setErrorCode(12289);
 } else if (!Module.ctx) {
  EGL.setErrorCode(12290);
 } else if (Module.ctx.isContextLost()) {
  EGL.setErrorCode(12302);
 } else {
  EGL.setErrorCode(12288);
  return 1;
 }
 return 0;
}

function _eglSwapInterval(display, interval) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 if (interval == 0) _emscripten_set_main_loop_timing(0, 0); else _emscripten_set_main_loop_timing(1, interval);
 EGL.setErrorCode(12288);
 return 1;
}

function _eglTerminate(display) {
 if (display != 62e3) {
  EGL.setErrorCode(12296);
  return 0;
 }
 EGL.currentContext = 0;
 EGL.currentReadSurface = 0;
 EGL.currentDrawSurface = 0;
 EGL.defaultDisplayInitialized = false;
 EGL.setErrorCode(12288);
 return 1;
}

function _eglWaitClient() {
 EGL.setErrorCode(12288);
 return 1;
}

function _eglWaitGL() {
 return _eglWaitClient.apply(null, arguments);
}

function _eglWaitNative(nativeEngineId) {
 EGL.setErrorCode(12288);
 return 1;
}

var JSEvents = {
 keyEvent: 0,
 mouseEvent: 0,
 wheelEvent: 0,
 uiEvent: 0,
 focusEvent: 0,
 deviceOrientationEvent: 0,
 deviceMotionEvent: 0,
 fullscreenChangeEvent: 0,
 pointerlockChangeEvent: 0,
 visibilityChangeEvent: 0,
 touchEvent: 0,
 previousFullscreenElement: null,
 previousScreenX: null,
 previousScreenY: null,
 removeEventListenersRegistered: false,
 removeAllEventListeners: function() {
  for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
   JSEvents._removeHandler(i);
  }
  JSEvents.eventHandlers = [];
  JSEvents.deferredCalls = [];
 },
 registerRemoveEventListeners: function() {
  if (!JSEvents.removeEventListenersRegistered) {
   __ATEXIT__.push(JSEvents.removeAllEventListeners);
   JSEvents.removeEventListenersRegistered = true;
  }
 },
 deferredCalls: [],
 deferCall: function(targetFunction, precedence, argsList) {
  function arraysHaveEqualContent(arrA, arrB) {
   if (arrA.length != arrB.length) return false;
   for (var i in arrA) {
    if (arrA[i] != arrB[i]) return false;
   }
   return true;
  }
  for (var i in JSEvents.deferredCalls) {
   var call = JSEvents.deferredCalls[i];
   if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
    return;
   }
  }
  JSEvents.deferredCalls.push({
   targetFunction: targetFunction,
   precedence: precedence,
   argsList: argsList
  });
  JSEvents.deferredCalls.sort(function(x, y) {
   return x.precedence < y.precedence;
  });
 },
 removeDeferredCalls: function(targetFunction) {
  for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
   if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
    JSEvents.deferredCalls.splice(i, 1);
    --i;
   }
  }
 },
 canPerformEventHandlerRequests: function() {
  return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
 },
 runDeferredCalls: function() {
  if (!JSEvents.canPerformEventHandlerRequests()) {
   return;
  }
  for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
   var call = JSEvents.deferredCalls[i];
   JSEvents.deferredCalls.splice(i, 1);
   --i;
   call.targetFunction.apply(this, call.argsList);
  }
 },
 inEventHandler: 0,
 currentEventHandler: null,
 eventHandlers: [],
 isInternetExplorer: function() {
  return navigator.userAgent.indexOf("MSIE") !== -1 || navigator.appVersion.indexOf("Trident/") > 0;
 },
 removeAllHandlersOnTarget: function(target, eventTypeString) {
  for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
   if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
    JSEvents._removeHandler(i--);
   }
  }
 },
 _removeHandler: function(i) {
  var h = JSEvents.eventHandlers[i];
  h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
  JSEvents.eventHandlers.splice(i, 1);
 },
 registerOrRemoveHandler: function(eventHandler) {
  var jsEventHandler = function jsEventHandler(event) {
   ++JSEvents.inEventHandler;
   JSEvents.currentEventHandler = eventHandler;
   JSEvents.runDeferredCalls();
   eventHandler.handlerFunc(event);
   JSEvents.runDeferredCalls();
   --JSEvents.inEventHandler;
  };
  if (eventHandler.callbackfunc) {
   eventHandler.eventListenerFunc = jsEventHandler;
   eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
   JSEvents.eventHandlers.push(eventHandler);
   JSEvents.registerRemoveEventListeners();
  } else {
   for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
    if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
     JSEvents._removeHandler(i--);
    }
   }
  }
 },
 getBoundingClientRectOrZeros: function(target) {
  return target.getBoundingClientRect ? target.getBoundingClientRect() : {
   left: 0,
   top: 0
  };
 },
 pageScrollPos: function() {
  if (window.pageXOffset > 0 || window.pageYOffset > 0) {
   return [ window.pageXOffset, window.pageYOffset ];
  }
  if (typeof document.documentElement.scrollLeft !== "undefined" || typeof document.documentElement.scrollTop !== "undefined") {
   return [ document.documentElement.scrollLeft, document.documentElement.scrollTop ];
  }
  return [ document.body.scrollLeft | 0, document.body.scrollTop | 0 ];
 },
 getNodeNameForTarget: function(target) {
  if (!target) return "";
  if (target == window) return "#window";
  if (target == screen) return "#screen";
  return target && target.nodeName ? target.nodeName : "";
 },
 tick: function() {
  if (window["performance"] && window["performance"]["now"]) return window["performance"]["now"](); else return Date.now();
 },
 fullscreenEnabled: function() {
  return document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
 }
};

function __setLetterbox(element, topBottom, leftRight) {
 if (JSEvents.isInternetExplorer()) {
  element.style.marginLeft = element.style.marginRight = leftRight + "px";
  element.style.marginTop = element.style.marginBottom = topBottom + "px";
 } else {
  element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
  element.style.paddingTop = element.style.paddingBottom = topBottom + "px";
 }
}

function __hideEverythingExceptGivenElement(onlyVisibleElement) {
 var child = onlyVisibleElement;
 var parent = child.parentNode;
 var hiddenElements = [];
 while (child != document.body) {
  var children = parent.children;
  for (var i = 0; i < children.length; ++i) {
   if (children[i] != child) {
    hiddenElements.push({
     node: children[i],
     displayState: children[i].style.display
    });
    children[i].style.display = "none";
   }
  }
  child = parent;
  parent = parent.parentNode;
 }
 return hiddenElements;
}

var __restoreOldWindowedStyle = null;

var __specialEventTargets = [ 0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0 ];

function __findEventTarget(target) {
 warnOnce("Rules for selecting event targets in HTML5 API are changing: instead of using document.getElementById() that only can refer to elements by their DOM ID, new event target selection mechanism uses the more flexible function document.querySelector() that can look up element names, classes, and complex CSS selectors. Build with -s DISABLE_DEPRECATED_FIND_EVENT_TARGET_BEHAVIOR=1 to change to the new lookup rules. See https://github.com/emscripten-core/emscripten/pull/7977 for more details.");
 try {
  if (!target) return window;
  if (typeof target === "number") target = __specialEventTargets[target] || UTF8ToString(target);
  if (target === "#window") return window; else if (target === "#document") return document; else if (target === "#screen") return screen; else if (target === "#canvas") return Module["canvas"];
  return typeof target === "string" ? document.getElementById(target) : target;
 } catch (e) {
  return null;
 }
}

function __findCanvasEventTarget(target) {
 if (typeof target === "number") target = UTF8ToString(target);
 if (!target || target === "#canvas") {
  if (typeof GL !== "undefined" && GL.offscreenCanvases["canvas"]) return GL.offscreenCanvases["canvas"];
  return Module["canvas"];
 }
 if (typeof GL !== "undefined" && GL.offscreenCanvases[target]) return GL.offscreenCanvases[target];
 return __findEventTarget(target);
}

function _emscripten_get_canvas_element_size(target, width, height) {
 var canvas = __findCanvasEventTarget(target);
 if (!canvas) return -4;
 HEAP32[width >> 2] = canvas.width;
 HEAP32[height >> 2] = canvas.height;
}

function __get_canvas_element_size(target) {
 var stackTop = stackSave();
 var w = stackAlloc(8);
 var h = w + 4;
 var targetInt = stackAlloc(target.id.length + 1);
 stringToUTF8(target.id, targetInt, target.id.length + 1);
 var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
 var size = [ HEAP32[w >> 2], HEAP32[h >> 2] ];
 stackRestore(stackTop);
 return size;
}

function _emscripten_set_canvas_element_size(target, width, height) {
 console.error("emscripten_set_canvas_element_size(target=" + target + ",width=" + width + ",height=" + height);
 var canvas = __findCanvasEventTarget(target);
 if (!canvas) return -4;
 canvas.width = width;
 canvas.height = height;
 return 0;
}

function __set_canvas_element_size(target, width, height) {
 console.error("_set_canvas_element_size(target=" + target + ",width=" + width + ",height=" + height);
 if (!target.controlTransferredOffscreen) {
  target.width = width;
  target.height = height;
 } else {
  var stackTop = stackSave();
  var targetInt = stackAlloc(target.id.length + 1);
  stringToUTF8(target.id, targetInt, target.id.length + 1);
  _emscripten_set_canvas_element_size(targetInt, width, height);
  stackRestore(stackTop);
 }
}

function __registerRestoreOldStyle(canvas) {
 var canvasSize = __get_canvas_element_size(canvas);
 var oldWidth = canvasSize[0];
 var oldHeight = canvasSize[1];
 var oldCssWidth = canvas.style.width;
 var oldCssHeight = canvas.style.height;
 var oldBackgroundColor = canvas.style.backgroundColor;
 var oldDocumentBackgroundColor = document.body.style.backgroundColor;
 var oldPaddingLeft = canvas.style.paddingLeft;
 var oldPaddingRight = canvas.style.paddingRight;
 var oldPaddingTop = canvas.style.paddingTop;
 var oldPaddingBottom = canvas.style.paddingBottom;
 var oldMarginLeft = canvas.style.marginLeft;
 var oldMarginRight = canvas.style.marginRight;
 var oldMarginTop = canvas.style.marginTop;
 var oldMarginBottom = canvas.style.marginBottom;
 var oldDocumentBodyMargin = document.body.style.margin;
 var oldDocumentOverflow = document.documentElement.style.overflow;
 var oldDocumentScroll = document.body.scroll;
 var oldImageRendering = canvas.style.imageRendering;
 function restoreOldStyle() {
  var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (!fullscreenElement) {
   document.removeEventListener("fullscreenchange", restoreOldStyle);
   document.removeEventListener("mozfullscreenchange", restoreOldStyle);
   document.removeEventListener("webkitfullscreenchange", restoreOldStyle);
   document.removeEventListener("MSFullscreenChange", restoreOldStyle);
   __set_canvas_element_size(canvas, oldWidth, oldHeight);
   canvas.style.width = oldCssWidth;
   canvas.style.height = oldCssHeight;
   canvas.style.backgroundColor = oldBackgroundColor;
   if (!oldDocumentBackgroundColor) document.body.style.backgroundColor = "white";
   document.body.style.backgroundColor = oldDocumentBackgroundColor;
   canvas.style.paddingLeft = oldPaddingLeft;
   canvas.style.paddingRight = oldPaddingRight;
   canvas.style.paddingTop = oldPaddingTop;
   canvas.style.paddingBottom = oldPaddingBottom;
   canvas.style.marginLeft = oldMarginLeft;
   canvas.style.marginRight = oldMarginRight;
   canvas.style.marginTop = oldMarginTop;
   canvas.style.marginBottom = oldMarginBottom;
   document.body.style.margin = oldDocumentBodyMargin;
   document.documentElement.style.overflow = oldDocumentOverflow;
   document.body.scroll = oldDocumentScroll;
   canvas.style.imageRendering = oldImageRendering;
   if (canvas.GLctxObject) canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
   if (__currentFullscreenStrategy.canvasResizedCallback) {
    dynCall_iiii(__currentFullscreenStrategy.canvasResizedCallback, 37, 0, __currentFullscreenStrategy.canvasResizedCallbackUserData);
   }
  }
 }
 document.addEventListener("fullscreenchange", restoreOldStyle);
 document.addEventListener("mozfullscreenchange", restoreOldStyle);
 document.addEventListener("webkitfullscreenchange", restoreOldStyle);
 document.addEventListener("MSFullscreenChange", restoreOldStyle);
 return restoreOldStyle;
}

function __restoreHiddenElements(hiddenElements) {
 for (var i = 0; i < hiddenElements.length; ++i) {
  hiddenElements[i].node.style.display = hiddenElements[i].displayState;
 }
}

var __currentFullscreenStrategy = {};

function __softFullscreenResizeWebGLRenderTarget() {
 var inHiDPIFullscreenMode = __currentFullscreenStrategy.canvasResolutionScaleMode == 2;
 var inAspectRatioFixedFullscreenMode = __currentFullscreenStrategy.scaleMode == 2;
 var inPixelPerfectFullscreenMode = __currentFullscreenStrategy.canvasResolutionScaleMode != 0;
 var inCenteredWithoutScalingFullscreenMode = __currentFullscreenStrategy.scaleMode == 3;
 var screenWidth = inHiDPIFullscreenMode ? Math.round(window.innerWidth * window.devicePixelRatio) : window.innerWidth;
 var screenHeight = inHiDPIFullscreenMode ? Math.round(window.innerHeight * window.devicePixelRatio) : window.innerHeight;
 var w = screenWidth;
 var h = screenHeight;
 var canvas = __currentFullscreenStrategy.target;
 var canvasSize = __get_canvas_element_size(canvas);
 var x = canvasSize[0];
 var y = canvasSize[1];
 var topMargin;
 if (inAspectRatioFixedFullscreenMode) {
  if (w * y < x * h) h = w * y / x | 0; else if (w * y > x * h) w = h * x / y | 0;
  topMargin = (screenHeight - h) / 2 | 0;
 }
 if (inPixelPerfectFullscreenMode) {
  __set_canvas_element_size(canvas, w, h);
  if (canvas.GLctxObject) canvas.GLctxObject.GLctx.viewport(0, 0, w, h);
 }
 if (inHiDPIFullscreenMode) {
  topMargin /= window.devicePixelRatio;
  w /= window.devicePixelRatio;
  h /= window.devicePixelRatio;
  w = Math.round(w * 1e4) / 1e4;
  h = Math.round(h * 1e4) / 1e4;
  topMargin = Math.round(topMargin * 1e4) / 1e4;
 }
 if (inCenteredWithoutScalingFullscreenMode) {
  var t = (window.innerHeight - parseInt(canvas.style.height)) / 2;
  var b = (window.innerWidth - parseInt(canvas.style.width)) / 2;
  __setLetterbox(canvas, t, b);
 } else {
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  var b = (window.innerWidth - w) / 2;
  __setLetterbox(canvas, topMargin, b);
 }
 if (!inCenteredWithoutScalingFullscreenMode && __currentFullscreenStrategy.canvasResizedCallback) {
  dynCall_iiii(__currentFullscreenStrategy.canvasResizedCallback, 37, 0, __currentFullscreenStrategy.canvasResizedCallbackUserData);
 }
}

function _JSEvents_resizeCanvasForFullscreen(target, strategy) {
 var restoreOldStyle = __registerRestoreOldStyle(target);
 var cssWidth = strategy.softFullscreen ? window.innerWidth : screen.width;
 var cssHeight = strategy.softFullscreen ? window.innerHeight : screen.height;
 var rect = target.getBoundingClientRect();
 var windowedCssWidth = rect.right - rect.left;
 var windowedCssHeight = rect.bottom - rect.top;
 var canvasSize = __get_canvas_element_size(target);
 var windowedRttWidth = canvasSize[0];
 var windowedRttHeight = canvasSize[1];
 if (strategy.scaleMode == 3) {
  __setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
  cssWidth = windowedCssWidth;
  cssHeight = windowedCssHeight;
 } else if (strategy.scaleMode == 2) {
  if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
   var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
   __setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
   cssHeight = desiredCssHeight;
  } else {
   var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
   __setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
   cssWidth = desiredCssWidth;
  }
 }
 if (!target.style.backgroundColor) target.style.backgroundColor = "black";
 if (!document.body.style.backgroundColor) document.body.style.backgroundColor = "black";
 target.style.width = cssWidth + "px";
 target.style.height = cssHeight + "px";
 if (strategy.filteringMode == 1) {
  target.style.imageRendering = "optimizeSpeed";
  target.style.imageRendering = "-moz-crisp-edges";
  target.style.imageRendering = "-o-crisp-edges";
  target.style.imageRendering = "-webkit-optimize-contrast";
  target.style.imageRendering = "optimize-contrast";
  target.style.imageRendering = "crisp-edges";
  target.style.imageRendering = "pixelated";
 }
 var dpiScale = strategy.canvasResolutionScaleMode == 2 ? window.devicePixelRatio : 1;
 if (strategy.canvasResolutionScaleMode != 0) {
  var newWidth = cssWidth * dpiScale | 0;
  var newHeight = cssHeight * dpiScale | 0;
  __set_canvas_element_size(target, newWidth, newHeight);
  if (target.GLctxObject) target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
 }
 return restoreOldStyle;
}

function _emscripten_enter_soft_fullscreen(target, fullscreenStrategy) {
 if (!target) target = "#canvas";
 target = __findEventTarget(target);
 if (!target) return -4;
 var strategy = {};
 strategy.scaleMode = HEAP32[fullscreenStrategy >> 2];
 strategy.canvasResolutionScaleMode = HEAP32[fullscreenStrategy + 4 >> 2];
 strategy.filteringMode = HEAP32[fullscreenStrategy + 8 >> 2];
 strategy.canvasResizedCallback = HEAP32[fullscreenStrategy + 12 >> 2];
 strategy.canvasResizedCallbackUserData = HEAP32[fullscreenStrategy + 16 >> 2];
 strategy.target = target;
 strategy.softFullscreen = true;
 var restoreOldStyle = _JSEvents_resizeCanvasForFullscreen(target, strategy);
 document.documentElement.style.overflow = "hidden";
 document.body.scroll = "no";
 document.body.style.margin = "0px";
 var hiddenElements = __hideEverythingExceptGivenElement(target);
 function restoreWindowedState() {
  restoreOldStyle();
  __restoreHiddenElements(hiddenElements);
  window.removeEventListener("resize", __softFullscreenResizeWebGLRenderTarget);
  if (strategy.canvasResizedCallback) {
   dynCall_iiii(strategy.canvasResizedCallback, 37, 0, strategy.canvasResizedCallbackUserData);
  }
  __currentFullscreenStrategy = 0;
 }
 __restoreOldWindowedStyle = restoreWindowedState;
 __currentFullscreenStrategy = strategy;
 window.addEventListener("resize", __softFullscreenResizeWebGLRenderTarget);
 if (strategy.canvasResizedCallback) {
  dynCall_iiii(strategy.canvasResizedCallback, 37, 0, strategy.canvasResizedCallbackUserData);
 }
 return 0;
}

function _JSEvents_requestFullscreen(target, strategy) {
 if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
  _JSEvents_resizeCanvasForFullscreen(target, strategy);
 }
 if (target.requestFullscreen) {
  target.requestFullscreen();
 } else if (target.msRequestFullscreen) {
  target.msRequestFullscreen();
 } else if (target.mozRequestFullScreen) {
  target.mozRequestFullScreen();
 } else if (target.mozRequestFullscreen) {
  target.mozRequestFullscreen();
 } else if (target.webkitRequestFullscreen) {
  target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
 } else {
  if (typeof JSEvents.fullscreenEnabled() === "undefined") {
   return -1;
  } else {
   return -3;
  }
 }
 if (strategy.canvasResizedCallback) {
  dynCall_iiii(strategy.canvasResizedCallback, 37, 0, strategy.canvasResizedCallbackUserData);
 }
 return 0;
}

function _emscripten_exit_fullscreen() {
 if (typeof JSEvents.fullscreenEnabled() === "undefined") return -1;
 JSEvents.removeDeferredCalls(_JSEvents_requestFullscreen);
 var d = __specialEventTargets[1];
 if (d.exitFullscreen) {
  d.fullscreenElement && d.exitFullscreen();
 } else if (d.msExitFullscreen) {
  d.msFullscreenElement && d.msExitFullscreen();
 } else if (d.mozCancelFullScreen) {
  d.mozFullScreenElement && d.mozCancelFullScreen();
 } else if (d.webkitExitFullscreen) {
  d.webkitFullscreenElement && d.webkitExitFullscreen();
 } else {
  return -1;
 }
 if (__currentFullscreenStrategy.canvasResizedCallback) {
  dynCall_iiii(__currentFullscreenStrategy.canvasResizedCallback, 37, 0, __currentFullscreenStrategy.canvasResizedCallbackUserData);
  __currentFullscreenStrategy = 0;
 }
 return 0;
}

function __requestPointerLock(target) {
 if (target.requestPointerLock) {
  target.requestPointerLock();
 } else if (target.mozRequestPointerLock) {
  target.mozRequestPointerLock();
 } else if (target.webkitRequestPointerLock) {
  target.webkitRequestPointerLock();
 } else if (target.msRequestPointerLock) {
  target.msRequestPointerLock();
 } else {
  if (document.body.requestPointerLock || document.body.mozRequestPointerLock || document.body.webkitRequestPointerLock || document.body.msRequestPointerLock) {
   return -3;
  } else {
   return -1;
  }
 }
 return 0;
}

function _emscripten_exit_pointerlock() {
 JSEvents.removeDeferredCalls(__requestPointerLock);
 if (document.exitPointerLock) {
  document.exitPointerLock();
 } else if (document.msExitPointerLock) {
  document.msExitPointerLock();
 } else if (document.mozExitPointerLock) {
  document.mozExitPointerLock();
 } else if (document.webkitExitPointerLock) {
  document.webkitExitPointerLock();
 } else {
  return -1;
 }
 return 0;
}

function __emscripten_traverse_stack(args) {
 if (!args || !args.callee || !args.callee.name) {
  return [ null, "", "" ];
 }
 var funstr = args.callee.toString();
 var funcname = args.callee.name;
 var str = "(";
 var first = true;
 for (var i in args) {
  var a = args[i];
  if (!first) {
   str += ", ";
  }
  first = false;
  if (typeof a === "number" || typeof a === "string") {
   str += a;
  } else {
   str += "(" + typeof a + ")";
  }
 }
 str += ")";
 var caller = args.callee.caller;
 args = caller ? caller.arguments : [];
 if (first) str = "";
 return [ args, funcname, str ];
}

function _emscripten_get_callstack_js(flags) {
 var callstack = jsStackTrace();
 var iThisFunc = callstack.lastIndexOf("_emscripten_log");
 var iThisFunc2 = callstack.lastIndexOf("_emscripten_get_callstack");
 var iNextLine = callstack.indexOf("\n", Math.max(iThisFunc, iThisFunc2)) + 1;
 callstack = callstack.slice(iNextLine);
 if (flags & 8 && typeof emscripten_source_map === "undefined") {
  warnOnce('Source map information is not available, emscripten_log with EM_LOG_C_STACK will be ignored. Build with "--pre-js $EMSCRIPTEN/src/emscripten-source-map.min.js" linker flag to add source map loading to code.');
  flags ^= 8;
  flags |= 16;
 }
 var stack_args = null;
 if (flags & 128) {
  stack_args = __emscripten_traverse_stack(arguments);
  while (stack_args[1].indexOf("_emscripten_") >= 0) stack_args = __emscripten_traverse_stack(stack_args[0]);
 }
 var lines = callstack.split("\n");
 callstack = "";
 var newFirefoxRe = new RegExp("\\s*(.*?)@(.*?):([0-9]+):([0-9]+)");
 var firefoxRe = new RegExp("\\s*(.*?)@(.*):(.*)(:(.*))?");
 var chromeRe = new RegExp("\\s*at (.*?) \\((.*):(.*):(.*)\\)");
 for (var l in lines) {
  var line = lines[l];
  var jsSymbolName = "";
  var file = "";
  var lineno = 0;
  var column = 0;
  var parts = chromeRe.exec(line);
  if (parts && parts.length == 5) {
   jsSymbolName = parts[1];
   file = parts[2];
   lineno = parts[3];
   column = parts[4];
  } else {
   parts = newFirefoxRe.exec(line);
   if (!parts) parts = firefoxRe.exec(line);
   if (parts && parts.length >= 4) {
    jsSymbolName = parts[1];
    file = parts[2];
    lineno = parts[3];
    column = parts[4] | 0;
   } else {
    callstack += line + "\n";
    continue;
   }
  }
  var cSymbolName = flags & 32 ? demangle(jsSymbolName) : jsSymbolName;
  if (!cSymbolName) {
   cSymbolName = jsSymbolName;
  }
  var haveSourceMap = false;
  if (flags & 8) {
   var orig = emscripten_source_map.originalPositionFor({
    line: lineno,
    column: column
   });
   haveSourceMap = orig && orig.source;
   if (haveSourceMap) {
    if (flags & 64) {
     orig.source = orig.source.substring(orig.source.replace(/\\/g, "/").lastIndexOf("/") + 1);
    }
    callstack += "    at " + cSymbolName + " (" + orig.source + ":" + orig.line + ":" + orig.column + ")\n";
   }
  }
  if (flags & 16 || !haveSourceMap) {
   if (flags & 64) {
    file = file.substring(file.replace(/\\/g, "/").lastIndexOf("/") + 1);
   }
   callstack += (haveSourceMap ? "     = " + jsSymbolName : "    at " + cSymbolName) + " (" + file + ":" + lineno + ":" + column + ")\n";
  }
  if (flags & 128 && stack_args[0]) {
   if (stack_args[1] == jsSymbolName && stack_args[2].length > 0) {
    callstack = callstack.replace(/\s+$/, "");
    callstack += " with values: " + stack_args[1] + stack_args[2] + "\n";
   }
   stack_args = __emscripten_traverse_stack(stack_args[0]);
  }
 }
 callstack = callstack.replace(/\s+$/, "");
 return callstack;
}

function _emscripten_get_callstack(flags, str, maxbytes) {
 var callstack = _emscripten_get_callstack_js(flags);
 if (!str || maxbytes <= 0) {
  return lengthBytesUTF8(callstack) + 1;
 }
 var bytesWrittenExcludingNull = stringToUTF8(callstack, str, maxbytes);
 return bytesWrittenExcludingNull + 1;
}

function _emscripten_get_device_pixel_ratio() {
 return window.devicePixelRatio || 1;
}

function _emscripten_get_element_css_size(target, width, height) {
 target = target ? __findEventTarget(target) : Module["canvas"];
 if (!target) return -4;
 if (target.getBoundingClientRect) {
  var rect = target.getBoundingClientRect();
  HEAPF64[width >> 3] = rect.right - rect.left;
  HEAPF64[height >> 3] = rect.bottom - rect.top;
 } else {
  HEAPF64[width >> 3] = target.clientWidth;
  HEAPF64[height >> 3] = target.clientHeight;
 }
 return 0;
}

function __fillFullscreenChangeEventData(eventStruct, e) {
 var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
 var isFullscreen = !!fullscreenElement;
 HEAP32[eventStruct >> 2] = isFullscreen;
 HEAP32[eventStruct + 4 >> 2] = JSEvents.fullscreenEnabled();
 var reportedElement = isFullscreen ? fullscreenElement : JSEvents.previousFullscreenElement;
 var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
 var id = reportedElement && reportedElement.id ? reportedElement.id : "";
 stringToUTF8(nodeName, eventStruct + 8, 128);
 stringToUTF8(id, eventStruct + 136, 128);
 HEAP32[eventStruct + 264 >> 2] = reportedElement ? reportedElement.clientWidth : 0;
 HEAP32[eventStruct + 268 >> 2] = reportedElement ? reportedElement.clientHeight : 0;
 HEAP32[eventStruct + 272 >> 2] = screen.width;
 HEAP32[eventStruct + 276 >> 2] = screen.height;
 if (isFullscreen) {
  JSEvents.previousFullscreenElement = fullscreenElement;
 }
}

function _emscripten_get_fullscreen_status(fullscreenStatus) {
 if (typeof JSEvents.fullscreenEnabled() === "undefined") return -1;
 __fillFullscreenChangeEventData(fullscreenStatus);
 return 0;
}

function __fillGamepadEventData(eventStruct, e) {
 HEAPF64[eventStruct >> 3] = e.timestamp;
 for (var i = 0; i < e.axes.length; ++i) {
  HEAPF64[eventStruct + i * 8 + 16 >> 3] = e.axes[i];
 }
 for (var i = 0; i < e.buttons.length; ++i) {
  if (typeof e.buttons[i] === "object") {
   HEAPF64[eventStruct + i * 8 + 528 >> 3] = e.buttons[i].value;
  } else {
   HEAPF64[eventStruct + i * 8 + 528 >> 3] = e.buttons[i];
  }
 }
 for (var i = 0; i < e.buttons.length; ++i) {
  if (typeof e.buttons[i] === "object") {
   HEAP32[eventStruct + i * 4 + 1040 >> 2] = e.buttons[i].pressed;
  } else {
   HEAP32[eventStruct + i * 4 + 1040 >> 2] = e.buttons[i] == 1;
  }
 }
 HEAP32[eventStruct + 1296 >> 2] = e.connected;
 HEAP32[eventStruct + 1300 >> 2] = e.index;
 HEAP32[eventStruct + 8 >> 2] = e.axes.length;
 HEAP32[eventStruct + 12 >> 2] = e.buttons.length;
 stringToUTF8(e.id, eventStruct + 1304, 64);
 stringToUTF8(e.mapping, eventStruct + 1368, 64);
}

function _emscripten_get_gamepad_status(index, gamepadState) {
 if (!JSEvents.lastGamepadState) throw "emscripten_get_gamepad_status() can only be called after having first called emscripten_sample_gamepad_data() and that function has returned EMSCRIPTEN_RESULT_SUCCESS!";
 if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5;
 if (!JSEvents.lastGamepadState[index]) return -7;
 __fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index]);
 return 0;
}

function _emscripten_get_heap_size() {
 return HEAP8.length;
}

function _emscripten_get_num_gamepads() {
 if (!JSEvents.lastGamepadState) throw "emscripten_get_num_gamepads() can only be called after having first called emscripten_sample_gamepad_data() and that function has returned EMSCRIPTEN_RESULT_SUCCESS!";
 return JSEvents.lastGamepadState.length;
}

function __fillPointerlockChangeEventData(eventStruct, e) {
 var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement;
 var isPointerlocked = !!pointerLockElement;
 HEAP32[eventStruct >> 2] = isPointerlocked;
 var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
 var id = pointerLockElement && pointerLockElement.id ? pointerLockElement.id : "";
 stringToUTF8(nodeName, eventStruct + 4, 128);
 stringToUTF8(id, eventStruct + 132, 128);
}

function _emscripten_get_pointerlock_status(pointerlockStatus) {
 if (pointerlockStatus) __fillPointerlockChangeEventData(pointerlockStatus);
 if (!document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
  return -1;
 }
 return 0;
}

function _emscripten_glActiveTexture(x0) {
 GLctx["activeTexture"](x0);
}

function _emscripten_glAttachShader(program, shader) {
 GL.validateGLObjectID(GL.programs, program, "glAttachShader", "program");
 GL.validateGLObjectID(GL.shaders, shader, "glAttachShader", "shader");
 GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}

function _emscripten_glBeginQuery(target, id) {
 GL.validateGLObjectID(GL.queries, id, "glBeginQuery", "id");
 GLctx["beginQuery"](target, GL.queries[id]);
}

function _emscripten_glBeginQueryEXT(target, id) {
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glBeginQueryEXT", "id");
 GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.timerQueriesEXT[id]);
}

function _emscripten_glBeginTransformFeedback(x0) {
 GLctx["beginTransformFeedback"](x0);
}

function _emscripten_glBindAttribLocation(program, index, name) {
 GL.validateGLObjectID(GL.programs, program, "glBindAttribLocation", "program");
 GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}

function _emscripten_glBindBuffer(target, buffer) {
 GL.validateGLObjectID(GL.buffers, buffer, "glBindBuffer", "buffer");
 if (target == 35051) {
  GLctx.currentPixelPackBufferBinding = buffer;
 } else if (target == 35052) {
  GLctx.currentPixelUnpackBufferBinding = buffer;
 }
 GLctx.bindBuffer(target, GL.buffers[buffer]);
}

function _emscripten_glBindBufferBase(target, index, buffer) {
 GL.validateGLObjectID(GL.buffers, buffer, "glBindBufferBase", "buffer");
 GLctx["bindBufferBase"](target, index, GL.buffers[buffer]);
}

function _emscripten_glBindBufferRange(target, index, buffer, offset, ptrsize) {
 GL.validateGLObjectID(GL.buffers, buffer, "glBindBufferRange", "buffer");
 GLctx["bindBufferRange"](target, index, GL.buffers[buffer], offset, ptrsize);
}

function _emscripten_glBindFramebuffer(target, framebuffer) {
 GL.validateGLObjectID(GL.framebuffers, framebuffer, "glBindFramebuffer", "framebuffer");
 GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
}

function _emscripten_glBindRenderbuffer(target, renderbuffer) {
 GL.validateGLObjectID(GL.renderbuffers, renderbuffer, "glBindRenderbuffer", "renderbuffer");
 GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
}

function _emscripten_glBindSampler(unit, sampler) {
 GL.validateGLObjectID(GL.samplers, sampler, "glBindSampler", "sampler");
 GLctx["bindSampler"](unit, GL.samplers[sampler]);
}

function _emscripten_glBindTexture(target, texture) {
 GL.validateGLObjectID(GL.textures, texture, "glBindTexture", "texture");
 GLctx.bindTexture(target, GL.textures[texture]);
}

function _emscripten_glBindTransformFeedback(target, id) {
 GL.validateGLObjectID(GL.transformFeedbacks, id, "glBindTransformFeedback", "id");
 GLctx["bindTransformFeedback"](target, GL.transformFeedbacks[id]);
}

function _emscripten_glBindVertexArray(vao) {
 assert(GLctx["bindVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 GLctx["bindVertexArray"](GL.vaos[vao]);
}

function _emscripten_glBindVertexArrayOES(vao) {
 assert(GLctx["bindVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 GLctx["bindVertexArray"](GL.vaos[vao]);
}

function _emscripten_glBlendColor(x0, x1, x2, x3) {
 GLctx["blendColor"](x0, x1, x2, x3);
}

function _emscripten_glBlendEquation(x0) {
 GLctx["blendEquation"](x0);
}

function _emscripten_glBlendEquationSeparate(x0, x1) {
 GLctx["blendEquationSeparate"](x0, x1);
}

function _emscripten_glBlendFunc(x0, x1) {
 GLctx["blendFunc"](x0, x1);
}

function _emscripten_glBlendFuncSeparate(x0, x1, x2, x3) {
 GLctx["blendFuncSeparate"](x0, x1, x2, x3);
}

function _emscripten_glBlitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) {
 GLctx["blitFramebuffer"](x0, x1, x2, x3, x4, x5, x6, x7, x8, x9);
}

function _emscripten_glBufferData(target, size, data, usage) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (data) {
   GLctx.bufferData(target, HEAPU8, usage, data, size);
  } else {
   GLctx.bufferData(target, size, usage);
  }
 } else {
  GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage);
 }
}

function _emscripten_glBufferSubData(target, offset, size, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.bufferSubData(target, offset, HEAPU8, data, size);
  return;
 }
 GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
}

function _emscripten_glCheckFramebufferStatus(x0) {
 return GLctx["checkFramebufferStatus"](x0);
}

function _emscripten_glClear(x0) {
 GLctx["clear"](x0);
}

function _emscripten_glClearBufferfi(x0, x1, x2, x3) {
 GLctx["clearBufferfi"](x0, x1, x2, x3);
}

function _emscripten_glClearBufferfv(buffer, drawbuffer, value) {
 assert((value & 3) == 0, "Pointer to float data passed to glClearBufferfv must be aligned to four bytes!");
 GLctx["clearBufferfv"](buffer, drawbuffer, HEAPF32, value >> 2);
}

function _emscripten_glClearBufferiv(buffer, drawbuffer, value) {
 assert((value & 3) == 0, "Pointer to integer data passed to glClearBufferiv must be aligned to four bytes!");
 GLctx["clearBufferiv"](buffer, drawbuffer, HEAP32, value >> 2);
}

function _emscripten_glClearBufferuiv(buffer, drawbuffer, value) {
 assert((value & 3) == 0, "Pointer to integer data passed to glClearBufferuiv must be aligned to four bytes!");
 GLctx["clearBufferuiv"](buffer, drawbuffer, HEAPU32, value >> 2);
}

function _emscripten_glClearColor(x0, x1, x2, x3) {
 GLctx["clearColor"](x0, x1, x2, x3);
}

function _emscripten_glClearDepthf(x0) {
 GLctx["clearDepth"](x0);
}

function _emscripten_glClearStencil(x0) {
 GLctx["clearStencil"](x0);
}

function _emscripten_glClientWaitSync(sync, flags, timeoutLo, timeoutHi) {
 timeoutLo = timeoutLo >>> 0;
 timeoutHi = timeoutHi >>> 0;
 var timeout = timeoutLo == 4294967295 && timeoutHi == 4294967295 ? -1 : makeBigInt(timeoutLo, timeoutHi, true);
 return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
}

function _emscripten_glColorMask(red, green, blue, alpha) {
 GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
}

function _emscripten_glCompileShader(shader) {
 GL.validateGLObjectID(GL.shaders, shader, "glCompileShader", "shader");
 GLctx.compileShader(GL.shaders[shader]);
 var log = (GLctx.getShaderInfoLog(GL.shaders[shader]) || "").trim();
 if (log) console.error("glCompileShader: " + log);
}

function _emscripten_glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, imageSize, data);
  } else {
   GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, HEAPU8, data, imageSize);
  }
  return;
 }
 GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, data ? HEAPU8.subarray(data, data + imageSize) : null);
}

function _emscripten_glCompressedTexImage3D(target, level, internalFormat, width, height, depth, border, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexImage3D"](target, level, internalFormat, width, height, depth, border, imageSize, data);
  } else {
   GLctx["compressedTexImage3D"](target, level, internalFormat, width, height, depth, border, HEAPU8, data, imageSize);
  }
 } else {
  GLctx["compressedTexImage3D"](target, level, internalFormat, width, height, depth, border, data ? HEAPU8.subarray(data, data + imageSize) : null);
 }
}

function _emscripten_glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, imageSize, data);
  } else {
   GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, HEAPU8, data, imageSize);
  }
  return;
 }
 GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, data ? HEAPU8.subarray(data, data + imageSize) : null);
}

function _emscripten_glCompressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, imageSize, data);
  } else {
   GLctx["compressedTexSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, HEAPU8, data, imageSize);
  }
 } else {
  GLctx["compressedTexSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, data ? HEAPU8.subarray(data, data + imageSize) : null);
 }
}

function _emscripten_glCopyBufferSubData(x0, x1, x2, x3, x4) {
 GLctx["copyBufferSubData"](x0, x1, x2, x3, x4);
}

function _emscripten_glCopyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
 GLctx["copyTexImage2D"](x0, x1, x2, x3, x4, x5, x6, x7);
}

function _emscripten_glCopyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
 GLctx["copyTexSubImage2D"](x0, x1, x2, x3, x4, x5, x6, x7);
}

function _emscripten_glCopyTexSubImage3D(x0, x1, x2, x3, x4, x5, x6, x7, x8) {
 GLctx["copyTexSubImage3D"](x0, x1, x2, x3, x4, x5, x6, x7, x8);
}

function _emscripten_glCreateProgram() {
 var id = GL.getNewId(GL.programs);
 var program = GLctx.createProgram();
 program.name = id;
 GL.programs[id] = program;
 return id;
}

function _emscripten_glCreateShader(shaderType) {
 var id = GL.getNewId(GL.shaders);
 GL.shaders[id] = GLctx.createShader(shaderType);
 return id;
}

function _emscripten_glCullFace(x0) {
 GLctx["cullFace"](x0);
}

function _emscripten_glDeleteBuffers(n, buffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[buffers + i * 4 >> 2];
  var buffer = GL.buffers[id];
  if (!buffer) continue;
  if (!GLctx) continue;
  GLctx.deleteBuffer(buffer);
  buffer.name = 0;
  GL.buffers[id] = null;
  if (id == GL.currArrayBuffer) GL.currArrayBuffer = 0;
  if (id == GL.currElementArrayBuffer) GL.currElementArrayBuffer = 0;
  if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
  if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
 }
}

function _emscripten_glDeleteFramebuffers(n, framebuffers) {
 for (var i = 0; i < n; ++i) {
  var id = HEAP32[framebuffers + i * 4 >> 2];
  var framebuffer = GL.framebuffers[id];
  if (!framebuffer) continue;
  GLctx.deleteFramebuffer(framebuffer);
  framebuffer.name = 0;
  GL.framebuffers[id] = null;
 }
}

function _emscripten_glDeleteProgram(id) {
 if (!id) return;
 var program = GL.programs[id];
 if (!program) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteProgram(program);
 program.name = 0;
 GL.programs[id] = null;
 GL.programInfos[id] = null;
}

function _emscripten_glDeleteQueries(n, ids) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[ids + i * 4 >> 2];
  var query = GL.queries[id];
  if (!query) continue;
  GLctx["deleteQuery"](query);
  GL.queries[id] = null;
 }
}

function _emscripten_glDeleteQueriesEXT(n, ids) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[ids + i * 4 >> 2];
  var query = GL.timerQueriesEXT[id];
  if (!query) continue;
  GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
  GL.timerQueriesEXT[id] = null;
 }
}

function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[renderbuffers + i * 4 >> 2];
  var renderbuffer = GL.renderbuffers[id];
  if (!renderbuffer) continue;
  GLctx.deleteRenderbuffer(renderbuffer);
  renderbuffer.name = 0;
  GL.renderbuffers[id] = null;
 }
}

function _emscripten_glDeleteSamplers(n, samplers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[samplers + i * 4 >> 2];
  var sampler = GL.samplers[id];
  if (!sampler) continue;
  GLctx["deleteSampler"](sampler);
  sampler.name = 0;
  GL.samplers[id] = null;
 }
}

function _emscripten_glDeleteShader(id) {
 if (!id) return;
 var shader = GL.shaders[id];
 if (!shader) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteShader(shader);
 GL.shaders[id] = null;
}

function _emscripten_glDeleteSync(id) {
 if (!id) return;
 var sync = GL.syncs[id];
 if (!sync) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteSync(sync);
 sync.name = 0;
 GL.syncs[id] = null;
}

function _emscripten_glDeleteTextures(n, textures) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[textures + i * 4 >> 2];
  var texture = GL.textures[id];
  if (!texture) continue;
  GLctx.deleteTexture(texture);
  texture.name = 0;
  GL.textures[id] = null;
 }
}

function _emscripten_glDeleteTransformFeedbacks(n, ids) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[ids + i * 4 >> 2];
  var transformFeedback = GL.transformFeedbacks[id];
  if (!transformFeedback) continue;
  GLctx["deleteTransformFeedback"](transformFeedback);
  transformFeedback.name = 0;
  GL.transformFeedbacks[id] = null;
 }
}

function _emscripten_glDeleteVertexArrays(n, vaos) {
 assert(GLctx["deleteVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 for (var i = 0; i < n; i++) {
  var id = HEAP32[vaos + i * 4 >> 2];
  GLctx["deleteVertexArray"](GL.vaos[id]);
  GL.vaos[id] = null;
 }
}

function _emscripten_glDeleteVertexArraysOES(n, vaos) {
 assert(GLctx["deleteVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 for (var i = 0; i < n; i++) {
  var id = HEAP32[vaos + i * 4 >> 2];
  GLctx["deleteVertexArray"](GL.vaos[id]);
  GL.vaos[id] = null;
 }
}

function _emscripten_glDepthFunc(x0) {
 GLctx["depthFunc"](x0);
}

function _emscripten_glDepthMask(flag) {
 GLctx.depthMask(!!flag);
}

function _emscripten_glDepthRangef(x0, x1) {
 GLctx["depthRange"](x0, x1);
}

function _emscripten_glDetachShader(program, shader) {
 GL.validateGLObjectID(GL.programs, program, "glDetachShader", "program");
 GL.validateGLObjectID(GL.shaders, shader, "glDetachShader", "shader");
 GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
}

function _emscripten_glDisable(x0) {
 GLctx["disable"](x0);
}

function _emscripten_glDisableVertexAttribArray(index) {
 GLctx.disableVertexAttribArray(index);
}

function _emscripten_glDrawArrays(mode, first, count) {
 GLctx.drawArrays(mode, first, count);
}

function _emscripten_glDrawArraysInstanced(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _emscripten_glDrawArraysInstancedANGLE(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _emscripten_glDrawArraysInstancedARB(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _emscripten_glDrawArraysInstancedEXT(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _emscripten_glDrawArraysInstancedNV(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

var __tempFixedLengthArray = [];

function _emscripten_glDrawBuffers(n, bufs) {
 assert(GLctx["drawBuffers"], "Must have WebGL2 or WEBGL_draw_buffers extension to use drawBuffers");
 assert(n < __tempFixedLengthArray.length, "Invalid count of numBuffers=" + n + " passed to glDrawBuffers (that many draw buffer points do not exist in GL)");
 var bufArray = __tempFixedLengthArray[n];
 for (var i = 0; i < n; i++) {
  bufArray[i] = HEAP32[bufs + i * 4 >> 2];
 }
 GLctx["drawBuffers"](bufArray);
}

function _emscripten_glDrawBuffersEXT(n, bufs) {
 assert(GLctx["drawBuffers"], "Must have WebGL2 or WEBGL_draw_buffers extension to use drawBuffers");
 assert(n < __tempFixedLengthArray.length, "Invalid count of numBuffers=" + n + " passed to glDrawBuffers (that many draw buffer points do not exist in GL)");
 var bufArray = __tempFixedLengthArray[n];
 for (var i = 0; i < n; i++) {
  bufArray[i] = HEAP32[bufs + i * 4 >> 2];
 }
 GLctx["drawBuffers"](bufArray);
}

function _emscripten_glDrawBuffersWEBGL(n, bufs) {
 assert(GLctx["drawBuffers"], "Must have WebGL2 or WEBGL_draw_buffers extension to use drawBuffers");
 assert(n < __tempFixedLengthArray.length, "Invalid count of numBuffers=" + n + " passed to glDrawBuffers (that many draw buffer points do not exist in GL)");
 var bufArray = __tempFixedLengthArray[n];
 for (var i = 0; i < n; i++) {
  bufArray[i] = HEAP32[bufs + i * 4 >> 2];
 }
 GLctx["drawBuffers"](bufArray);
}

function _emscripten_glDrawElements(mode, count, type, indices) {
 GLctx.drawElements(mode, count, type, indices);
}

function _emscripten_glDrawElementsInstanced(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _emscripten_glDrawElementsInstancedANGLE(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _emscripten_glDrawElementsInstancedARB(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _emscripten_glDrawElementsInstancedEXT(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _emscripten_glDrawElementsInstancedNV(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _glDrawElements(mode, count, type, indices) {
 GLctx.drawElements(mode, count, type, indices);
}

function _emscripten_glDrawRangeElements(mode, start, end, count, type, indices) {
 _glDrawElements(mode, count, type, indices);
}

function _emscripten_glEnable(x0) {
 GLctx["enable"](x0);
}

function _emscripten_glEnableVertexAttribArray(index) {
 GLctx.enableVertexAttribArray(index);
}

function _emscripten_glEndQuery(x0) {
 GLctx["endQuery"](x0);
}

function _emscripten_glEndQueryEXT(target) {
 GLctx.disjointTimerQueryExt["endQueryEXT"](target);
}

function _emscripten_glEndTransformFeedback() {
 GLctx["endTransformFeedback"]();
}

function _emscripten_glFenceSync(condition, flags) {
 var sync = GLctx.fenceSync(condition, flags);
 if (sync) {
  var id = GL.getNewId(GL.syncs);
  sync.name = id;
  GL.syncs[id] = sync;
  return id;
 } else {
  return 0;
 }
}

function _emscripten_glFinish() {
 GLctx["finish"]();
}

function _emscripten_glFlush() {
 GLctx["flush"]();
}

function _emscripten_glFlushMappedBufferRange() {
 err("missing function: emscripten_glFlushMappedBufferRange");
 abort(-1);
}

function _emscripten_glFramebufferRenderbuffer(target, attachment, renderbuffertarget, renderbuffer) {
 GL.validateGLObjectID(GL.renderbuffers, renderbuffer, "glFramebufferRenderbuffer", "renderbuffer");
 GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
}

function _emscripten_glFramebufferTexture2D(target, attachment, textarget, texture, level) {
 GL.validateGLObjectID(GL.textures, texture, "glFramebufferTexture2D", "texture");
 GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
}

function _emscripten_glFramebufferTextureLayer(target, attachment, texture, level, layer) {
 GL.validateGLObjectID(GL.textures, texture, "glFramebufferTextureLayer", "texture");
 GLctx.framebufferTextureLayer(target, attachment, GL.textures[texture], level, layer);
}

function _emscripten_glFrontFace(x0) {
 GLctx["frontFace"](x0);
}

function __glGenObject(n, buffers, createFunction, objectTable, functionName) {
 for (var i = 0; i < n; i++) {
  var buffer = GLctx[createFunction]();
  var id = buffer && GL.getNewId(objectTable);
  if (buffer) {
   buffer.name = id;
   objectTable[id] = buffer;
  } else {
   GL.recordError(1282);
   err("GL_INVALID_OPERATION in " + functionName + ": GLctx." + createFunction + " returned null - most likely GL context is lost!");
  }
  HEAP32[buffers + i * 4 >> 2] = id;
 }
}

function _emscripten_glGenBuffers(n, buffers) {
 __glGenObject(n, buffers, "createBuffer", GL.buffers, "glGenBuffers");
}

function _emscripten_glGenFramebuffers(n, ids) {
 __glGenObject(n, ids, "createFramebuffer", GL.framebuffers, "glGenFramebuffers");
}

function _emscripten_glGenQueries(n, ids) {
 __glGenObject(n, ids, "createQuery", GL.queries, "glGenQueries");
}

function _emscripten_glGenQueriesEXT(n, ids) {
 for (var i = 0; i < n; i++) {
  var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
  if (!query) {
   GL.recordError(1282);
   err("GL_INVALID_OPERATION in glGenQueriesEXT: GLctx.disjointTimerQueryExt.createQueryEXT returned null - most likely GL context is lost!");
   while (i < n) HEAP32[ids + i++ * 4 >> 2] = 0;
   return;
  }
  var id = GL.getNewId(GL.timerQueriesEXT);
  query.name = id;
  GL.timerQueriesEXT[id] = query;
  HEAP32[ids + i * 4 >> 2] = id;
 }
}

function _emscripten_glGenRenderbuffers(n, renderbuffers) {
 __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers, "glGenRenderbuffers");
}

function _emscripten_glGenSamplers(n, samplers) {
 __glGenObject(n, samplers, "createSampler", GL.samplers, "glGenSamplers");
}

function _emscripten_glGenTextures(n, textures) {
 __glGenObject(n, textures, "createTexture", GL.textures, "glGenTextures");
}

function _emscripten_glGenTransformFeedbacks(n, ids) {
 __glGenObject(n, ids, "createTransformFeedback", GL.transformFeedbacks, "glGenTransformFeedbacks");
}

function _emscripten_glGenVertexArrays(n, arrays) {
 assert(GLctx["createVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 __glGenObject(n, arrays, "createVertexArray", GL.vaos, "glGenVertexArrays");
}

function _emscripten_glGenVertexArraysOES(n, arrays) {
 assert(GLctx["createVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 __glGenObject(n, arrays, "createVertexArray", GL.vaos, "glGenVertexArrays");
}

function _emscripten_glGenerateMipmap(x0) {
 GLctx["generateMipmap"](x0);
}

function _emscripten_glGetActiveAttrib(program, index, bufSize, length, size, type, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetActiveAttrib", "program");
 program = GL.programs[program];
 var info = GLctx.getActiveAttrib(program, index);
 if (!info) return;
 if (bufSize > 0 && name) {
  var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
 if (size) HEAP32[size >> 2] = info.size;
 if (type) HEAP32[type >> 2] = info.type;
}

function _emscripten_glGetActiveUniform(program, index, bufSize, length, size, type, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetActiveUniform", "program");
 program = GL.programs[program];
 var info = GLctx.getActiveUniform(program, index);
 if (!info) return;
 if (bufSize > 0 && name) {
  var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
 if (size) HEAP32[size >> 2] = info.size;
 if (type) HEAP32[type >> 2] = info.type;
}

function _emscripten_glGetActiveUniformBlockName(program, uniformBlockIndex, bufSize, length, uniformBlockName) {
 GL.validateGLObjectID(GL.programs, program, "glGetActiveUniformBlockName", "program");
 program = GL.programs[program];
 var result = GLctx["getActiveUniformBlockName"](program, uniformBlockIndex);
 if (!result) return;
 if (uniformBlockName && bufSize > 0) {
  var numBytesWrittenExclNull = stringToUTF8(result, uniformBlockName, bufSize);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _emscripten_glGetActiveUniformBlockiv(program, uniformBlockIndex, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetActiveUniformBlockiv(program=" + program + ", uniformBlockIndex=" + uniformBlockIndex + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.programs, program, "glGetActiveUniformBlockiv", "program");
 program = GL.programs[program];
 switch (pname) {
 case 35393:
  var name = GLctx["getActiveUniformBlockName"](program, uniformBlockIndex);
  HEAP32[params >> 2] = name.length + 1;
  return;

 default:
  var result = GLctx["getActiveUniformBlockParameter"](program, uniformBlockIndex, pname);
  if (!result) return;
  if (typeof result == "number") {
   HEAP32[params >> 2] = result;
  } else {
   for (var i = 0; i < result.length; i++) {
    HEAP32[params + i * 4 >> 2] = result[i];
   }
  }
 }
}

function _emscripten_glGetActiveUniformsiv(program, uniformCount, uniformIndices, pname, params) {
 GL.validateGLObjectID(GL.programs, program, "glGetActiveUniformsiv", "program");
 if (!params) {
  err("GL_INVALID_VALUE in glGetActiveUniformsiv(program=" + program + ", uniformCount=" + uniformCount + ", uniformIndices=" + uniformIndices + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 if (uniformCount > 0 && uniformIndices == 0) {
  GL.recordError(1281);
  return;
 }
 program = GL.programs[program];
 var ids = [];
 for (var i = 0; i < uniformCount; i++) {
  ids.push(HEAP32[uniformIndices + i * 4 >> 2]);
 }
 var result = GLctx["getActiveUniforms"](program, ids, pname);
 if (!result) return;
 var len = result.length;
 for (var i = 0; i < len; i++) {
  HEAP32[params + i * 4 >> 2] = result[i];
 }
}

function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
 GL.validateGLObjectID(GL.programs, program, "glGetAttachedShaders", "program");
 var result = GLctx.getAttachedShaders(GL.programs[program]);
 var len = result.length;
 if (len > maxCount) {
  len = maxCount;
 }
 HEAP32[count >> 2] = len;
 for (var i = 0; i < len; ++i) {
  var id = GL.shaders.indexOf(result[i]);
  assert(id !== -1, "shader not bound to local id");
  HEAP32[shaders + i * 4 >> 2] = id;
 }
}

function _emscripten_glGetAttribLocation(program, name) {
 return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}

function emscriptenWebGLGet(name_, p, type) {
 if (!p) {
  err("GL_INVALID_VALUE in glGet" + type + "v(name=" + name_ + ": Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 var ret = undefined;
 switch (name_) {
 case 36346:
  ret = 1;
  break;

 case 36344:
  if (type !== "Integer" && type !== "Integer64") {
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGet" + type + "v(GL_SHADER_BINARY_FORMATS): Invalid parameter type!");
  }
  return;

 case 34814:
 case 36345:
  ret = 0;
  break;

 case 34466:
  var formats = GLctx.getParameter(34467);
  ret = formats ? formats.length : 0;
  break;

 case 33309:
  if (GL.currentContext.version < 2) {
   GL.recordError(1282);
   return;
  }
  var exts = GLctx.getSupportedExtensions();
  ret = 2 * exts.length;
  break;

 case 33307:
 case 33308:
  if (GL.currentContext.version < 2) {
   GL.recordError(1280);
   return;
  }
  ret = name_ == 33307 ? 3 : 0;
  break;
 }
 if (ret === undefined) {
  var result = GLctx.getParameter(name_);
  switch (typeof result) {
  case "number":
   ret = result;
   break;

  case "boolean":
   ret = result ? 1 : 0;
   break;

  case "string":
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGet" + type + "v(" + name_ + ") on a name which returns a string!");
   return;

  case "object":
   if (result === null) {
    switch (name_) {
    case 34964:
    case 35725:
    case 34965:
    case 36006:
    case 36007:
    case 32873:
    case 34229:
    case 35097:
    case 36389:
    case 34068:
     {
      ret = 0;
      break;
     }

    default:
     {
      GL.recordError(1280);
      err("GL_INVALID_ENUM in glGet" + type + "v(" + name_ + ") and it returns null!");
      return;
     }
    }
   } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
    for (var i = 0; i < result.length; ++i) {
     switch (type) {
     case "Integer":
      HEAP32[p + i * 4 >> 2] = result[i];
      break;

     case "Float":
      HEAPF32[p + i * 4 >> 2] = result[i];
      break;

     case "Boolean":
      HEAP8[p + i >> 0] = result[i] ? 1 : 0;
      break;

     default:
      throw "internal glGet error, bad type: " + type;
     }
    }
    return;
   } else {
    try {
     ret = result.name | 0;
    } catch (e) {
     GL.recordError(1280);
     err("GL_INVALID_ENUM in glGet" + type + "v: Unknown object returned from WebGL getParameter(" + name_ + ")! (error: " + e + ")");
     return;
    }
   }
   break;

  default:
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGet" + type + "v: Native code calling glGet" + type + "v(" + name_ + ") and it returns " + result + " of type " + typeof result + "!");
   return;
  }
 }
 switch (type) {
 case "Integer64":
  tempI64 = [ ret >>> 0, (tempDouble = ret, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[p >> 2] = tempI64[0], HEAP32[p + 4 >> 2] = tempI64[1];
  break;

 case "Integer":
  HEAP32[p >> 2] = ret;
  break;

 case "Float":
  HEAPF32[p >> 2] = ret;
  break;

 case "Boolean":
  HEAP8[p >> 0] = ret ? 1 : 0;
  break;

 default:
  throw "internal glGet error, bad type: " + type;
 }
}

function _emscripten_glGetBooleanv(name_, p) {
 emscriptenWebGLGet(name_, p, "Boolean");
}

function _emscripten_glGetBufferParameteri64v(target, value, data) {
 if (!data) {
  err("GL_INVALID_VALUE in glGetBufferParameteri64v(target=" + target + ", value=" + value + ", data=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 tempI64 = [ GLctx.getBufferParameter(target, value) >>> 0, (tempDouble = GLctx.getBufferParameter(target, value), 
 +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
 HEAP32[data >> 2] = tempI64[0], HEAP32[data + 4 >> 2] = tempI64[1];
}

function _emscripten_glGetBufferParameteriv(target, value, data) {
 if (!data) {
  err("GL_INVALID_VALUE in glGetBufferParameteriv(target=" + target + ", value=" + value + ", data=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[data >> 2] = GLctx.getBufferParameter(target, value);
}

function _emscripten_glGetBufferPointerv() {
 err("missing function: emscripten_glGetBufferPointerv");
 abort(-1);
}

function _emscripten_glGetError() {
 if (GL.lastError) {
  var error = GL.lastError;
  GL.lastError = 0;
  return error;
 } else {
  return GLctx.getError();
 }
}

function _emscripten_glGetFloatv(name_, p) {
 emscriptenWebGLGet(name_, p, "Float");
}

function _emscripten_glGetFragDataLocation(program, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetFragDataLocation", "program");
 return GLctx["getFragDataLocation"](GL.programs[program], UTF8ToString(name));
}

function _emscripten_glGetFramebufferAttachmentParameteriv(target, attachment, pname, params) {
 var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
 if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
  result = result.name | 0;
 }
 HEAP32[params >> 2] = result;
}

function emscriptenWebGLGetIndexed(target, index, data, type) {
 if (!data) {
  err("GL_INVALID_VALUE in glGetInteger(64)i_v(target=" + target + ", index=" + index + ", data=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 var result = GLctx["getIndexedParameter"](target, index);
 var ret;
 switch (typeof result) {
 case "boolean":
  ret = result ? 1 : 0;
  break;

 case "number":
  ret = result;
  break;

 case "object":
  if (result === null) {
   switch (target) {
   case 35983:
   case 35368:
    ret = 0;
    break;

   default:
    {
     GL.recordError(1280);
     err("GL_INVALID_ENUM in glGetInteger(64)i_v(" + target + ") and it returns null!");
     return;
    }
   }
  } else if (result instanceof WebGLBuffer) {
   ret = result.name | 0;
  } else {
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGetInteger(64)i_v: Unknown object returned from WebGL getIndexedParameter(" + target + ")!");
   return;
  }
  break;

 default:
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glGetInteger(64)i_v: Native code calling glGetInteger(64)i_v(" + target + ") and it returns " + result + " of type " + typeof result + "!");
  return;
 }
 switch (type) {
 case "Integer64":
  tempI64 = [ ret >>> 0, (tempDouble = ret, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
  HEAP32[data >> 2] = tempI64[0], HEAP32[data + 4 >> 2] = tempI64[1];
  break;

 case "Integer":
  HEAP32[data >> 2] = ret;
  break;

 case "Float":
  HEAPF32[data >> 2] = ret;
  break;

 case "Boolean":
  HEAP8[data >> 0] = ret ? 1 : 0;
  break;

 default:
  throw "internal emscriptenWebGLGetIndexed() error, bad type: " + type;
 }
}

function _emscripten_glGetInteger64i_v(target, index, data) {
 emscriptenWebGLGetIndexed(target, index, data, "Integer64");
}

function _emscripten_glGetInteger64v(name_, p) {
 emscriptenWebGLGet(name_, p, "Integer64");
}

function _emscripten_glGetIntegeri_v(target, index, data) {
 emscriptenWebGLGetIndexed(target, index, data, "Integer");
}

function _emscripten_glGetIntegerv(name_, p) {
 emscriptenWebGLGet(name_, p, "Integer");
}

function _emscripten_glGetInternalformativ() {
 err("missing function: emscripten_glGetInternalformativ");
 abort(-1);
}

function _emscripten_glGetProgramBinary(program, bufSize, length, binaryFormat, binary) {
 GL.recordError(1282);
 err("GL_INVALID_OPERATION in glGetProgramBinary: WebGL does not support binary shader formats! Calls to glGetProgramBinary always fail. See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.4");
}

function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
 GL.validateGLObjectID(GL.programs, program, "glGetProgramInfoLog", "program");
 var log = GLctx.getProgramInfoLog(GL.programs[program]);
 if (log === null) log = "(unknown error)";
 if (maxLength > 0 && infoLog) {
  var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _emscripten_glGetProgramiv(program, pname, p) {
 if (!p) {
  err("GL_INVALID_VALUE in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.programs, program, "glGetProgramiv", "program");
 if (program >= GL.counter) {
  err("GL_INVALID_VALUE in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0x" + p.toString(16) + "): The specified program object name was not generated by GL!");
  GL.recordError(1281);
  return;
 }
 var ptable = GL.programInfos[program];
 if (!ptable) {
  err("GL_INVALID_OPERATION in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0x" + p.toString(16) + "): The specified GL object name does not refer to a program object!");
  GL.recordError(1282);
  return;
 }
 if (pname == 35716) {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  HEAP32[p >> 2] = log.length + 1;
 } else if (pname == 35719) {
  HEAP32[p >> 2] = ptable.maxUniformLength;
 } else if (pname == 35722) {
  if (ptable.maxAttributeLength == -1) {
   program = GL.programs[program];
   var numAttribs = GLctx.getProgramParameter(program, 35721);
   ptable.maxAttributeLength = 0;
   for (var i = 0; i < numAttribs; ++i) {
    var activeAttrib = GLctx.getActiveAttrib(program, i);
    ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxAttributeLength;
 } else if (pname == 35381) {
  if (ptable.maxUniformBlockNameLength == -1) {
   program = GL.programs[program];
   var numBlocks = GLctx.getProgramParameter(program, 35382);
   ptable.maxUniformBlockNameLength = 0;
   for (var i = 0; i < numBlocks; ++i) {
    var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
    ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
 } else {
  HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
 }
}

function _emscripten_glGetQueryObjecti64vEXT(id, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryObject(u)i64vEXT(id=" + id + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glGetQueryObjecti64vEXT", "id");
 var query = GL.timerQueriesEXT[id];
 var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
 var ret;
 if (typeof param == "boolean") {
  ret = param ? 1 : 0;
 } else {
  ret = param;
 }
 tempI64 = [ ret >>> 0, (tempDouble = ret, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
 HEAP32[params >> 2] = tempI64[0], HEAP32[params + 4 >> 2] = tempI64[1];
}

function _emscripten_glGetQueryObjectivEXT(id, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryObject(u)ivEXT(id=" + id + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glGetQueryObjectivEXT", "id");
 var query = GL.timerQueriesEXT[id];
 var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
 var ret;
 if (typeof param == "boolean") {
  ret = param ? 1 : 0;
 } else {
  ret = param;
 }
 HEAP32[params >> 2] = ret;
}

function _emscripten_glGetQueryObjectui64vEXT(id, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryObject(u)i64vEXT(id=" + id + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glGetQueryObjecti64vEXT", "id");
 var query = GL.timerQueriesEXT[id];
 var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
 var ret;
 if (typeof param == "boolean") {
  ret = param ? 1 : 0;
 } else {
  ret = param;
 }
 tempI64 = [ ret >>> 0, (tempDouble = ret, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], 
 HEAP32[params >> 2] = tempI64[0], HEAP32[params + 4 >> 2] = tempI64[1];
}

function _emscripten_glGetQueryObjectuiv(id, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryObjectuiv(id=" + id + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.queries, id, "glGetQueryObjectuiv", "id");
 var query = GL.queries[id];
 var param = GLctx["getQueryParameter"](query, pname);
 var ret;
 if (typeof param == "boolean") {
  ret = param ? 1 : 0;
 } else {
  ret = param;
 }
 HEAP32[params >> 2] = ret;
}

function _emscripten_glGetQueryObjectuivEXT(id, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryObject(u)ivEXT(id=" + id + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glGetQueryObjectivEXT", "id");
 var query = GL.timerQueriesEXT[id];
 var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
 var ret;
 if (typeof param == "boolean") {
  ret = param ? 1 : 0;
 } else {
  ret = param;
 }
 HEAP32[params >> 2] = ret;
}

function _emscripten_glGetQueryiv(target, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryiv(target=" + target + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[params >> 2] = GLctx["getQuery"](target, pname);
}

function _emscripten_glGetQueryivEXT(target, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetQueryivEXT(target=" + target + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[params >> 2] = GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname);
}

function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetRenderbufferParameteriv(target=" + target + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[params >> 2] = GLctx.getRenderbufferParameter(target, pname);
}

function _emscripten_glGetSamplerParameterfv(sampler, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetSamplerParameterfv(sampler=" + sampler + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 sampler = GL.samplers[sampler];
 HEAPF32[params >> 2] = GLctx["getSamplerParameter"](sampler, pname);
}

function _emscripten_glGetSamplerParameteriv(sampler, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetSamplerParameteriv(sampler=" + sampler + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 sampler = GL.samplers[sampler];
 HEAP32[params >> 2] = GLctx["getSamplerParameter"](sampler, pname);
}

function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
 GL.validateGLObjectID(GL.shaders, shader, "glGetShaderInfoLog", "shader");
 var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
 if (log === null) log = "(unknown error)";
 if (maxLength > 0 && infoLog) {
  var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _emscripten_glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
 var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
 HEAP32[range >> 2] = result.rangeMin;
 HEAP32[range + 4 >> 2] = result.rangeMax;
 HEAP32[precision >> 2] = result.precision;
}

function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
 GL.validateGLObjectID(GL.shaders, shader, "glGetShaderSource", "shader");
 var result = GLctx.getShaderSource(GL.shaders[shader]);
 if (!result) return;
 if (bufSize > 0 && source) {
  var numBytesWrittenExclNull = stringToUTF8(result, source, bufSize);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _emscripten_glGetShaderiv(shader, pname, p) {
 if (!p) {
  err("GL_INVALID_VALUE in glGetShaderiv(shader=" + shader + ", pname=" + pname + ", p=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.shaders, shader, "glGetShaderiv", "shader");
 if (pname == 35716) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  HEAP32[p >> 2] = log.length + 1;
 } else if (pname == 35720) {
  var source = GLctx.getShaderSource(GL.shaders[shader]);
  var sourceLength = source === null || source.length == 0 ? 0 : source.length + 1;
  HEAP32[p >> 2] = sourceLength;
 } else {
  HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
 }
}

function stringToNewUTF8(jsString) {
 var length = lengthBytesUTF8(jsString) + 1;
 var cString = _malloc(length);
 stringToUTF8(jsString, cString, length);
 return cString;
}

function _emscripten_glGetString(name_) {
 if (GL.stringCache[name_]) return GL.stringCache[name_];
 var ret;
 switch (name_) {
 case 7939:
  var exts = GLctx.getSupportedExtensions();
  var gl_exts = [];
  for (var i = 0; i < exts.length; ++i) {
   gl_exts.push(exts[i]);
   gl_exts.push("GL_" + exts[i]);
  }
  ret = stringToNewUTF8(gl_exts.join(" "));
  break;

 case 7936:
 case 7937:
 case 37445:
 case 37446:
  var s = GLctx.getParameter(name_);
  if (!s) {
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGetString: Received empty parameter for query name " + name_ + "!");
  }
  ret = stringToNewUTF8(s);
  break;

 case 7938:
  var glVersion = GLctx.getParameter(GLctx.VERSION);
  if (GL.currentContext.version >= 2) glVersion = "OpenGL ES 3.0 (" + glVersion + ")"; else {
   glVersion = "OpenGL ES 2.0 (" + glVersion + ")";
  }
  ret = stringToNewUTF8(glVersion);
  break;

 case 35724:
  var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION);
  var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
  var ver_num = glslVersion.match(ver_re);
  if (ver_num !== null) {
   if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
   glslVersion = "OpenGL ES GLSL ES " + ver_num[1] + " (" + glslVersion + ")";
  }
  ret = stringToNewUTF8(glslVersion);
  break;

 default:
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glGetString: Unknown parameter " + name_ + "!");
  return 0;
 }
 GL.stringCache[name_] = ret;
 return ret;
}

function _emscripten_glGetStringi(name, index) {
 if (GL.currentContext.version < 2) {
  GL.recordError(1282);
  return 0;
 }
 var stringiCache = GL.stringiCache[name];
 if (stringiCache) {
  if (index < 0 || index >= stringiCache.length) {
   GL.recordError(1281);
   err("GL_INVALID_VALUE in glGetStringi: index out of range (" + index + ")!");
   return 0;
  }
  return stringiCache[index];
 }
 switch (name) {
 case 7939:
  var exts = GLctx.getSupportedExtensions();
  var gl_exts = [];
  for (var i = 0; i < exts.length; ++i) {
   gl_exts.push(stringToNewUTF8(exts[i]));
   gl_exts.push(stringToNewUTF8("GL_" + exts[i]));
  }
  stringiCache = GL.stringiCache[name] = gl_exts;
  if (index < 0 || index >= stringiCache.length) {
   GL.recordError(1281);
   err("GL_INVALID_VALUE in glGetStringi: index out of range (" + index + ") in a call to GL_EXTENSIONS!");
   return 0;
  }
  return stringiCache[index];

 default:
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glGetStringi: Unknown parameter " + name + "!");
  return 0;
 }
}

function _emscripten_glGetSynciv(sync, pname, bufSize, length, values) {
 if (bufSize < 0) {
  err("GL_INVALID_VALUE in glGetSynciv(sync=" + sync + ", pname=" + pname + ", bufSize=" + bufSize + ", length=" + length + ", values=" + values + "): Function called with bufSize < 0!");
  GL.recordError(1281);
  return;
 }
 if (!values) {
  err("GL_INVALID_VALUE in glGetSynciv(sync=" + sync + ", pname=" + pname + ", bufSize=" + bufSize + ", length=" + length + ", values=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 var ret = GLctx.getSyncParameter(GL.syncs[sync], pname);
 HEAP32[length >> 2] = ret;
 if (ret !== null && length) HEAP32[length >> 2] = 1;
}

function _emscripten_glGetTexParameterfv(target, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetTexParameterfv(target=" + target + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAPF32[params >> 2] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetTexParameteriv(target, pname, params) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetTexParameteriv(target=" + target + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[params >> 2] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetTransformFeedbackVarying(program, index, bufSize, length, size, type, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetTransformFeedbackVarying", "program");
 program = GL.programs[program];
 var info = GLctx["getTransformFeedbackVarying"](program, index);
 if (!info) return;
 if (name && bufSize > 0) {
  var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
 if (size) HEAP32[size >> 2] = info.size;
 if (type) HEAP32[type >> 2] = info.type;
}

function _emscripten_glGetUniformBlockIndex(program, uniformBlockName) {
 GL.validateGLObjectID(GL.programs, program, "glGetUniformBlockIndex", "program");
 return GLctx["getUniformBlockIndex"](GL.programs[program], UTF8ToString(uniformBlockName));
}

function _emscripten_glGetUniformIndices(program, uniformCount, uniformNames, uniformIndices) {
 GL.validateGLObjectID(GL.programs, program, "glGetUniformIndices", "program");
 if (!uniformIndices) {
  err("GL_INVALID_VALUE in glGetUniformIndices(program=" + program + ", uniformCount=" + uniformCount + ", uniformNames=" + uniformNames + ", uniformIndices=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 if (uniformCount > 0 && (uniformNames == 0 || uniformIndices == 0)) {
  GL.recordError(1281);
  return;
 }
 program = GL.programs[program];
 var names = [];
 for (var i = 0; i < uniformCount; i++) names.push(UTF8ToString(HEAP32[uniformNames + i * 4 >> 2]));
 var result = GLctx["getUniformIndices"](program, names);
 if (!result) return;
 var len = result.length;
 for (var i = 0; i < len; i++) {
  HEAP32[uniformIndices + i * 4 >> 2] = result[i];
 }
}

function _emscripten_glGetUniformLocation(program, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetUniformLocation", "program");
 name = UTF8ToString(name);
 var arrayIndex = 0;
 if (name[name.length - 1] == "]") {
  var leftBrace = name.lastIndexOf("[");
  arrayIndex = name[leftBrace + 1] != "]" ? parseInt(name.slice(leftBrace + 1)) : 0;
  name = name.slice(0, leftBrace);
 }
 var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
 if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
  return uniformInfo[1] + arrayIndex;
 } else {
  return -1;
 }
}

function emscriptenWebGLGetUniform(program, location, params, type) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetUniform*v(program=" + program + ", location=" + location + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.programs, program, "glGetUniform*v", "program");
 GL.validateGLObjectID(GL.uniforms, location, "glGetUniform*v", "location");
 var data = GLctx.getUniform(GL.programs[program], GL.uniforms[location]);
 if (typeof data == "number" || typeof data == "boolean") {
  switch (type) {
  case "Integer":
   HEAP32[params >> 2] = data;
   break;

  case "Float":
   HEAPF32[params >> 2] = data;
   break;

  default:
   throw "internal emscriptenWebGLGetUniform() error, bad type: " + type;
  }
 } else {
  for (var i = 0; i < data.length; i++) {
   switch (type) {
   case "Integer":
    HEAP32[params + i * 4 >> 2] = data[i];
    break;

   case "Float":
    HEAPF32[params + i * 4 >> 2] = data[i];
    break;

   default:
    throw "internal emscriptenWebGLGetUniform() error, bad type: " + type;
   }
  }
 }
}

function _emscripten_glGetUniformfv(program, location, params) {
 emscriptenWebGLGetUniform(program, location, params, "Float");
}

function _emscripten_glGetUniformiv(program, location, params) {
 emscriptenWebGLGetUniform(program, location, params, "Integer");
}

function _emscripten_glGetUniformuiv(program, location, params) {
 emscriptenWebGLGetUniform(program, location, params, "Integer");
}

function emscriptenWebGLGetVertexAttrib(index, pname, params, type) {
 if (!params) {
  err("GL_INVALID_VALUE in glGetVertexAttrib*v(index=" + index + ", pname=" + pname + ", params=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 var data = GLctx.getVertexAttrib(index, pname);
 if (pname == 34975) {
  HEAP32[params >> 2] = data["name"];
 } else if (typeof data == "number" || typeof data == "boolean") {
  switch (type) {
  case "Integer":
   HEAP32[params >> 2] = data;
   break;

  case "Float":
   HEAPF32[params >> 2] = data;
   break;

  case "FloatToInteger":
   HEAP32[params >> 2] = Math.fround(data);
   break;

  default:
   throw "internal emscriptenWebGLGetVertexAttrib() error, bad type: " + type;
  }
 } else {
  for (var i = 0; i < data.length; i++) {
   switch (type) {
   case "Integer":
    HEAP32[params + i * 4 >> 2] = data[i];
    break;

   case "Float":
    HEAPF32[params + i * 4 >> 2] = data[i];
    break;

   case "FloatToInteger":
    HEAP32[params + i * 4 >> 2] = Math.fround(data[i]);
    break;

   default:
    throw "internal emscriptenWebGLGetVertexAttrib() error, bad type: " + type;
   }
  }
 }
}

function _emscripten_glGetVertexAttribIiv(index, pname, params) {
 emscriptenWebGLGetVertexAttrib(index, pname, params, "Integer");
}

function _emscripten_glGetVertexAttribIuiv(index, pname, params) {
 emscriptenWebGLGetVertexAttrib(index, pname, params, "Integer");
}

function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
 if (!pointer) {
  err("GL_INVALID_VALUE in glGetVertexAttribPointerv(index=" + index + ", pname=" + pname + ", pointer=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 HEAP32[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname);
}

function _emscripten_glGetVertexAttribfv(index, pname, params) {
 emscriptenWebGLGetVertexAttrib(index, pname, params, "Float");
}

function _emscripten_glGetVertexAttribiv(index, pname, params) {
 emscriptenWebGLGetVertexAttrib(index, pname, params, "FloatToInteger");
}

function _emscripten_glHint(x0, x1) {
 GLctx["hint"](x0, x1);
}

function _emscripten_glInvalidateFramebuffer(target, numAttachments, attachments) {
 assert(numAttachments < __tempFixedLengthArray.length, "Invalid count of numAttachments=" + numAttachments + " passed to glInvalidateFramebuffer (that many attachment points do not exist in GL)");
 var list = __tempFixedLengthArray[numAttachments];
 for (var i = 0; i < numAttachments; i++) {
  list[i] = HEAP32[attachments + i * 4 >> 2];
 }
 GLctx["invalidateFramebuffer"](target, list);
}

function _emscripten_glInvalidateSubFramebuffer(target, numAttachments, attachments, x, y, width, height) {
 assert(numAttachments < __tempFixedLengthArray.length, "Invalid count of numAttachments=" + numAttachments + " passed to glInvalidateSubFramebuffer (that many attachment points do not exist in GL)");
 var list = __tempFixedLengthArray[numAttachments];
 for (var i = 0; i < numAttachments; i++) {
  list[i] = HEAP32[attachments + i * 4 >> 2];
 }
 GLctx["invalidateSubFramebuffer"](target, list, x, y, width, height);
}

function _emscripten_glIsBuffer(buffer) {
 var b = GL.buffers[buffer];
 if (!b) return 0;
 return GLctx.isBuffer(b);
}

function _emscripten_glIsEnabled(x0) {
 return GLctx["isEnabled"](x0);
}

function _emscripten_glIsFramebuffer(framebuffer) {
 var fb = GL.framebuffers[framebuffer];
 if (!fb) return 0;
 return GLctx.isFramebuffer(fb);
}

function _emscripten_glIsProgram(program) {
 program = GL.programs[program];
 if (!program) return 0;
 return GLctx.isProgram(program);
}

function _emscripten_glIsQuery(id) {
 var query = GL.queries[id];
 if (!query) return 0;
 return GLctx["isQuery"](query);
}

function _emscripten_glIsQueryEXT(id) {
 var query = GL.timerQueriesEXT[id];
 if (!query) return 0;
 return GLctx.disjointTimerQueryExt["isQueryEXT"](query);
}

function _emscripten_glIsRenderbuffer(renderbuffer) {
 var rb = GL.renderbuffers[renderbuffer];
 if (!rb) return 0;
 return GLctx.isRenderbuffer(rb);
}

function _emscripten_glIsSampler(id) {
 var sampler = GL.samplers[id];
 if (!sampler) return 0;
 return GLctx["isSampler"](sampler);
}

function _emscripten_glIsShader(shader) {
 var s = GL.shaders[shader];
 if (!s) return 0;
 return GLctx.isShader(s);
}

function _emscripten_glIsSync(sync) {
 var sync = GL.syncs[sync];
 if (!sync) return 0;
 return GLctx.isSync(sync);
}

function _emscripten_glIsTexture(id) {
 var texture = GL.textures[id];
 if (!texture) return 0;
 return GLctx.isTexture(texture);
}

function _emscripten_glIsTransformFeedback(id) {
 return GLctx["isTransformFeedback"](GL.transformFeedbacks[id]);
}

function _emscripten_glIsVertexArray(array) {
 assert(GLctx["isVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 var vao = GL.vaos[array];
 if (!vao) return 0;
 return GLctx["isVertexArray"](vao);
}

function _emscripten_glIsVertexArrayOES(array) {
 assert(GLctx["isVertexArray"], "Must have WebGL2 or OES_vertex_array_object to use vao");
 var vao = GL.vaos[array];
 if (!vao) return 0;
 return GLctx["isVertexArray"](vao);
}

function _emscripten_glLineWidth(x0) {
 GLctx["lineWidth"](x0);
}

function _emscripten_glLinkProgram(program) {
 GL.validateGLObjectID(GL.programs, program, "glLinkProgram", "program");
 GLctx.linkProgram(GL.programs[program]);
 var log = (GLctx.getProgramInfoLog(GL.programs[program]) || "").trim();
 if (log) console.error("glLinkProgram: " + log);
 GL.populateUniformTable(program);
}

function _emscripten_glMapBufferRange() {
 err("missing function: emscripten_glMapBufferRange");
 abort(-1);
}

function _emscripten_glPauseTransformFeedback() {
 GLctx["pauseTransformFeedback"]();
}

function _emscripten_glPixelStorei(pname, param) {
 if (pname == 3317) {
  GL.unpackAlignment = param;
 }
 GLctx.pixelStorei(pname, param);
}

function _emscripten_glPolygonOffset(x0, x1) {
 GLctx["polygonOffset"](x0, x1);
}

function _emscripten_glProgramBinary(program, binaryFormat, binary, length) {
 GL.recordError(1280);
 err("GL_INVALID_ENUM in glProgramBinary: WebGL does not support binary shader formats! Calls to glProgramBinary always fail. See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.4");
}

function _emscripten_glProgramParameteri(program, pname, value) {
 GL.recordError(1280);
 err("GL_INVALID_ENUM in glProgramParameteri: WebGL does not support binary shader formats! Calls to glProgramParameteri always fail. See https://www.khronos.org/registry/webgl/specs/latest/2.0/#5.4");
}

function _emscripten_glQueryCounterEXT(id, target) {
 GL.validateGLObjectID(GL.timerQueriesEXT, id, "glQueryCounterEXT", "id");
 GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.timerQueriesEXT[id], target);
}

function _emscripten_glReadBuffer(x0) {
 GLctx["readBuffer"](x0);
}

function __computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
 function roundedToNextMultipleOf(x, y) {
  assert((y & y - 1) === 0, "Unpack alignment must be a power of 2! (Allowed values per WebGL spec are 1, 2, 4 or 8)");
  return x + y - 1 & -y;
 }
 var plainRowSize = width * sizePerPixel;
 var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
 return height * alignedRowSize;
}

var __colorChannelsInGlTextureFormat = {
 6402: 1,
 6403: 1,
 6406: 1,
 6407: 3,
 6408: 4,
 6409: 1,
 6410: 2,
 33319: 2,
 33320: 2,
 35904: 3,
 35906: 4,
 36244: 1,
 36248: 3,
 36249: 4
};

var __sizeOfGlTextureElementType = {
 5120: 1,
 5121: 1,
 5122: 2,
 5123: 2,
 5124: 4,
 5125: 4,
 5126: 4,
 5131: 2,
 32819: 2,
 32820: 2,
 33635: 2,
 33640: 4,
 34042: 4,
 35899: 4,
 35902: 4,
 36193: 2
};

function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
 var sizePerPixel = __colorChannelsInGlTextureFormat[format] * __sizeOfGlTextureElementType[type];
 if (!sizePerPixel) {
  GL.recordError(1280);
  if (!__colorChannelsInGlTextureFormat[format]) err("GL_INVALID_ENUM due to unknown format in glTex[Sub]Image/glReadPixels, format: " + format); else err("GL_INVALID_ENUM in glTex[Sub]Image/glReadPixels, type: " + type + ", format: " + format);
  return;
 }
 var bytes = __computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
 var end = pixels + bytes;
 switch (type) {
 case 5120:
  return HEAP8.subarray(pixels, end);

 case 5121:
  return HEAPU8.subarray(pixels, end);

 case 5122:
  assert((pixels & 1) == 0, "Pointer to int16 data passed to texture get function must be aligned to two bytes!");
  return HEAP16.subarray(pixels >> 1, end >> 1);

 case 5124:
  assert((pixels & 3) == 0, "Pointer to integer data passed to texture get function must be aligned to four bytes!");
  return HEAP32.subarray(pixels >> 2, end >> 2);

 case 5126:
  assert((pixels & 3) == 0, "Pointer to float data passed to texture get function must be aligned to four bytes!");
  return HEAPF32.subarray(pixels >> 2, end >> 2);

 case 5125:
 case 34042:
 case 35902:
 case 33640:
 case 35899:
 case 34042:
  assert((pixels & 3) == 0, "Pointer to integer data passed to texture get function must be aligned to four bytes!");
  return HEAPU32.subarray(pixels >> 2, end >> 2);

 case 5123:
 case 33635:
 case 32819:
 case 32820:
 case 36193:
 case 5131:
  assert((pixels & 1) == 0, "Pointer to int16 data passed to texture get function must be aligned to two bytes!");
  return HEAPU16.subarray(pixels >> 1, end >> 1);

 default:
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glTex[Sub]Image/glReadPixels, type: " + type);
 }
}

function __heapObjectForWebGLType(type) {
 switch (type) {
 case 5120:
  return HEAP8;

 case 5121:
  return HEAPU8;

 case 5122:
  return HEAP16;

 case 5123:
 case 33635:
 case 32819:
 case 32820:
 case 36193:
 case 5131:
  return HEAPU16;

 case 5124:
  return HEAP32;

 case 5125:
 case 34042:
 case 35902:
 case 33640:
 case 35899:
 case 34042:
  return HEAPU32;

 case 5126:
  return HEAPF32;
 }
}

var __heapAccessShiftForWebGLType = {
 5122: 1,
 5123: 1,
 5124: 2,
 5125: 2,
 5126: 2,
 5131: 1,
 32819: 1,
 32820: 1,
 33635: 1,
 33640: 2,
 34042: 2,
 35899: 2,
 35902: 2,
 36193: 1
};

function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelPackBufferBinding) {
   GLctx.readPixels(x, y, width, height, format, type, pixels);
  } else {
   GLctx.readPixels(x, y, width, height, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  }
  return;
 }
 var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
 if (!pixelData) {
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glReadPixels: Unrecognized combination of type=" + type + " and format=" + format + "!");
  return;
 }
 GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

function _emscripten_glReleaseShaderCompiler() {}

function _emscripten_glRenderbufferStorage(x0, x1, x2, x3) {
 GLctx["renderbufferStorage"](x0, x1, x2, x3);
}

function _emscripten_glRenderbufferStorageMultisample(x0, x1, x2, x3, x4) {
 GLctx["renderbufferStorageMultisample"](x0, x1, x2, x3, x4);
}

function _emscripten_glResumeTransformFeedback() {
 GLctx["resumeTransformFeedback"]();
}

function _emscripten_glSampleCoverage(value, invert) {
 GLctx.sampleCoverage(value, !!invert);
}

function _emscripten_glSamplerParameterf(sampler, pname, param) {
 GL.validateGLObjectID(GL.samplers, sampler, "glBindSampler", "sampler");
 GLctx["samplerParameterf"](GL.samplers[sampler], pname, param);
}

function _emscripten_glSamplerParameterfv(sampler, pname, params) {
 GL.validateGLObjectID(GL.samplers, sampler, "glBindSampler", "sampler");
 var param = HEAPF32[params >> 2];
 GLctx["samplerParameterf"](GL.samplers[sampler], pname, param);
}

function _emscripten_glSamplerParameteri(sampler, pname, param) {
 GL.validateGLObjectID(GL.samplers, sampler, "glBindSampler", "sampler");
 GLctx["samplerParameteri"](GL.samplers[sampler], pname, param);
}

function _emscripten_glSamplerParameteriv(sampler, pname, params) {
 GL.validateGLObjectID(GL.samplers, sampler, "glBindSampler", "sampler");
 var param = HEAP32[params >> 2];
 GLctx["samplerParameteri"](GL.samplers[sampler], pname, param);
}

function _emscripten_glScissor(x0, x1, x2, x3) {
 GLctx["scissor"](x0, x1, x2, x3);
}

function _emscripten_glShaderBinary() {
 GL.recordError(1280);
 err("GL_INVALID_ENUM in glShaderBinary: WebGL does not support binary shader formats! Calls to glShaderBinary always fail.");
}

function _emscripten_glShaderSource(shader, count, string, length) {
 GL.validateGLObjectID(GL.shaders, shader, "glShaderSource", "shader");
 var source = GL.getSource(shader, count, string, length);
 if (GL.currentContext.version >= 2) {
  if (source.indexOf("#version 100") != -1) {
   source = source.replace(/#extension GL_OES_standard_derivatives : enable/g, "");
   source = source.replace(/#extension GL_EXT_shader_texture_lod : enable/g, "");
   var prelude = "";
   if (source.indexOf("gl_FragColor") != -1) {
    prelude += "out mediump vec4 GL_FragColor;\n";
    source = source.replace(/gl_FragColor/g, "GL_FragColor");
   }
   if (source.indexOf("attribute") != -1) {
    source = source.replace(/attribute/g, "in");
    source = source.replace(/varying/g, "out");
   } else {
    source = source.replace(/varying/g, "in");
   }
   source = source.replace(/textureCubeLodEXT/g, "textureCubeLod");
   source = source.replace(/texture2DLodEXT/g, "texture2DLod");
   source = source.replace(/texture2DProjLodEXT/g, "texture2DProjLod");
   source = source.replace(/texture2DGradEXT/g, "texture2DGrad");
   source = source.replace(/texture2DProjGradEXT/g, "texture2DProjGrad");
   source = source.replace(/textureCubeGradEXT/g, "textureCubeGrad");
   source = source.replace(/textureCube/g, "texture");
   source = source.replace(/texture1D/g, "texture");
   source = source.replace(/texture2D/g, "texture");
   source = source.replace(/texture3D/g, "texture");
   source = source.replace(/#version 100/g, "#version 300 es\n" + prelude);
  }
 }
 GLctx.shaderSource(GL.shaders[shader], source);
}

function _emscripten_glStencilFunc(x0, x1, x2) {
 GLctx["stencilFunc"](x0, x1, x2);
}

function _emscripten_glStencilFuncSeparate(x0, x1, x2, x3) {
 GLctx["stencilFuncSeparate"](x0, x1, x2, x3);
}

function _emscripten_glStencilMask(x0) {
 GLctx["stencilMask"](x0);
}

function _emscripten_glStencilMaskSeparate(x0, x1) {
 GLctx["stencilMaskSeparate"](x0, x1);
}

function _emscripten_glStencilOp(x0, x1, x2) {
 GLctx["stencilOp"](x0, x1, x2);
}

function _emscripten_glStencilOpSeparate(x0, x1, x2, x3) {
 GLctx["stencilOpSeparate"](x0, x1, x2, x3);
}

function _emscripten_glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
 if (GL.currentContext.version >= 2) {
  if (format == 6402 && internalFormat == 6402 && type == 5125) {
   internalFormat = 33190;
  }
  if (type == 36193) {
   type = 5131;
   if (format == 6408 && internalFormat == 6408) {
    internalFormat = 34842;
   }
  }
  if (internalFormat == 34041) {
   internalFormat = 35056;
  }
 }
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
  } else if (pixels != 0) {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  } else {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, null);
  }
  return;
 }
 GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
}

function _emscripten_glTexImage3D(target, level, internalFormat, width, height, depth, border, format, type, pixels) {
 if (GLctx.currentPixelUnpackBufferBinding) {
  GLctx["texImage3D"](target, level, internalFormat, width, height, depth, border, format, type, pixels);
 } else if (pixels != 0) {
  GLctx["texImage3D"](target, level, internalFormat, width, height, depth, border, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
 } else {
  GLctx["texImage3D"](target, level, internalFormat, width, height, depth, border, format, type, null);
 }
}

function _emscripten_glTexParameterf(x0, x1, x2) {
 GLctx["texParameterf"](x0, x1, x2);
}

function _emscripten_glTexParameterfv(target, pname, params) {
 var param = HEAPF32[params >> 2];
 GLctx.texParameterf(target, pname, param);
}

function _emscripten_glTexParameteri(x0, x1, x2) {
 GLctx["texParameteri"](x0, x1, x2);
}

function _emscripten_glTexParameteriv(target, pname, params) {
 var param = HEAP32[params >> 2];
 GLctx.texParameteri(target, pname, param);
}

function _emscripten_glTexStorage2D(x0, x1, x2, x3, x4) {
 GLctx["texStorage2D"](x0, x1, x2, x3, x4);
}

function _emscripten_glTexStorage3D(x0, x1, x2, x3, x4, x5) {
 GLctx["texStorage3D"](x0, x1, x2, x3, x4, x5);
}

function _emscripten_glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
 if (GL.currentContext.version >= 2) {
  if (type == 36193) type = 5131;
 }
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
  } else if (pixels != 0) {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  } else {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, null);
  }
  return;
 }
 var pixelData = null;
 if (pixels) pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
 GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
}

function _emscripten_glTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels) {
 if (GLctx.currentPixelUnpackBufferBinding) {
  GLctx["texSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, pixels);
 } else if (pixels != 0) {
  GLctx["texSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
 } else {
  GLctx["texSubImage3D"](target, level, xoffset, yoffset, zoffset, width, height, depth, format, type, null);
 }
}

function _emscripten_glTransformFeedbackVaryings(program, count, varyings, bufferMode) {
 GL.validateGLObjectID(GL.programs, program, "glTransformFeedbackVaryings", "program");
 program = GL.programs[program];
 var vars = [];
 for (var i = 0; i < count; i++) vars.push(UTF8ToString(HEAP32[varyings + i * 4 >> 2]));
 GLctx["transformFeedbackVaryings"](program, vars, bufferMode);
}

function _emscripten_glUniform1f(location, v0) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1f", "location");
 GLctx.uniform1f(GL.uniforms[location], v0);
}

function _emscripten_glUniform1fv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniform1fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform1fv(GL.uniforms[location], HEAPF32, value >> 2, count);
  return;
 }
 if (count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[count - 1];
  for (var i = 0; i < count; ++i) {
   view[i] = HEAPF32[value + 4 * i >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 4 >> 2);
 }
 GLctx.uniform1fv(GL.uniforms[location], view);
}

function _emscripten_glUniform1i(location, v0) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1i", "location");
 GLctx.uniform1i(GL.uniforms[location], v0);
}

function _emscripten_glUniform1iv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1iv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform1iv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform1iv(GL.uniforms[location], HEAP32, value >> 2, count);
  return;
 }
 GLctx.uniform1iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 4 >> 2));
}

function _emscripten_glUniform1ui(location, v0) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1ui", "location");
 GLctx.uniform1ui(GL.uniforms[location], v0);
}

function _emscripten_glUniform1uiv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1uiv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform1uiv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform1uiv(GL.uniforms[location], HEAPU32, value >> 2, count);
 } else {
  GLctx.uniform1uiv(GL.uniforms[location], HEAPU32.subarray(value >> 2, value + count * 4 >> 2));
 }
}

function _emscripten_glUniform2f(location, v0, v1) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2f", "location");
 GLctx.uniform2f(GL.uniforms[location], v0, v1);
}

function _emscripten_glUniform2fv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniform2fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform2fv(GL.uniforms[location], HEAPF32, value >> 2, count * 2);
  return;
 }
 if (2 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[2 * count - 1];
  for (var i = 0; i < 2 * count; i += 2) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 8 >> 2);
 }
 GLctx.uniform2fv(GL.uniforms[location], view);
}

function _emscripten_glUniform2i(location, v0, v1) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2i", "location");
 GLctx.uniform2i(GL.uniforms[location], v0, v1);
}

function _emscripten_glUniform2iv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2iv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform2iv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform2iv(GL.uniforms[location], HEAP32, value >> 2, count * 2);
  return;
 }
 GLctx.uniform2iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 8 >> 2));
}

function _emscripten_glUniform2ui(location, v0, v1) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2ui", "location");
 GLctx.uniform2ui(GL.uniforms[location], v0, v1);
}

function _emscripten_glUniform2uiv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform2uiv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform2uiv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform2uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 2);
 } else {
  GLctx.uniform2uiv(GL.uniforms[location], HEAPU32.subarray(value >> 2, value + count * 8 >> 2));
 }
}

function _emscripten_glUniform3f(location, v0, v1, v2) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3f", "location");
 GLctx.uniform3f(GL.uniforms[location], v0, v1, v2);
}

function _emscripten_glUniform3fv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniform3fv must be aligned to four bytes!" + value);
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform3fv(GL.uniforms[location], HEAPF32, value >> 2, count * 3);
  return;
 }
 if (3 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[3 * count - 1];
  for (var i = 0; i < 3 * count; i += 3) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 12 >> 2);
 }
 GLctx.uniform3fv(GL.uniforms[location], view);
}

function _emscripten_glUniform3i(location, v0, v1, v2) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3i", "location");
 GLctx.uniform3i(GL.uniforms[location], v0, v1, v2);
}

function _emscripten_glUniform3iv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3iv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform3iv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform3iv(GL.uniforms[location], HEAP32, value >> 2, count * 3);
  return;
 }
 GLctx.uniform3iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 12 >> 2));
}

function _emscripten_glUniform3ui(location, v0, v1, v2) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3ui", "location");
 GLctx.uniform3ui(GL.uniforms[location], v0, v1, v2);
}

function _emscripten_glUniform3uiv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform3uiv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform3uiv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform3uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 3);
 } else {
  GLctx.uniform3uiv(GL.uniforms[location], HEAPU32.subarray(value >> 2, value + count * 12 >> 2));
 }
}

function _emscripten_glUniform4f(location, v0, v1, v2, v3) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4f", "location");
 GLctx.uniform4f(GL.uniforms[location], v0, v1, v2, v3);
}

function _emscripten_glUniform4fv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniform4fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4fv(GL.uniforms[location], HEAPF32, value >> 2, count * 4);
  return;
 }
 if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[4 * count - 1];
  for (var i = 0; i < 4 * count; i += 4) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
   view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2);
 }
 GLctx.uniform4fv(GL.uniforms[location], view);
}

function _emscripten_glUniform4i(location, v0, v1, v2, v3) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4i", "location");
 GLctx.uniform4i(GL.uniforms[location], v0, v1, v2, v3);
}

function _emscripten_glUniform4iv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4iv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform4iv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4iv(GL.uniforms[location], HEAP32, value >> 2, count * 4);
  return;
 }
 GLctx.uniform4iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 16 >> 2));
}

function _emscripten_glUniform4ui(location, v0, v1, v2, v3) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4ui", "location");
 GLctx.uniform4ui(GL.uniforms[location], v0, v1, v2, v3);
}

function _emscripten_glUniform4uiv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4uiv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform4uiv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 4);
 } else {
  GLctx.uniform4uiv(GL.uniforms[location], HEAPU32.subarray(value >> 2, value + count * 16 >> 2));
 }
}

function _emscripten_glUniformBlockBinding(program, uniformBlockIndex, uniformBlockBinding) {
 GL.validateGLObjectID(GL.programs, program, "glUniformBlockBinding", "program");
 program = GL.programs[program];
 GLctx["uniformBlockBinding"](program, uniformBlockIndex, uniformBlockBinding);
}

function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix2fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix2fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix2fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 4);
  return;
 }
 if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[4 * count - 1];
  for (var i = 0; i < 4 * count; i += 4) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
   view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2);
 }
 GLctx.uniformMatrix2fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUniformMatrix2x3fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix2x3fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix2x3fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix2x3fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 6);
 } else {
  GLctx.uniformMatrix2x3fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 24 >> 2));
 }
}

function _emscripten_glUniformMatrix2x4fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix2x4fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix2x4fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix2x4fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 8);
 } else {
  GLctx.uniformMatrix2x4fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 32 >> 2));
 }
}

function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix3fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix3fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 9);
  return;
 }
 if (9 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[9 * count - 1];
  for (var i = 0; i < 9 * count; i += 9) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
   view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
   view[i + 4] = HEAPF32[value + (4 * i + 16) >> 2];
   view[i + 5] = HEAPF32[value + (4 * i + 20) >> 2];
   view[i + 6] = HEAPF32[value + (4 * i + 24) >> 2];
   view[i + 7] = HEAPF32[value + (4 * i + 28) >> 2];
   view[i + 8] = HEAPF32[value + (4 * i + 32) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 36 >> 2);
 }
 GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUniformMatrix3x2fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix3x2fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix3x2fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix3x2fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 6);
 } else {
  GLctx.uniformMatrix3x2fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 24 >> 2));
 }
}

function _emscripten_glUniformMatrix3x4fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix3x4fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix3x4fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix3x4fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 12);
 } else {
  GLctx.uniformMatrix3x4fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 48 >> 2));
 }
}

function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix4fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix4fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 16);
  return;
 }
 if (16 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[16 * count - 1];
  for (var i = 0; i < 16 * count; i += 16) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
   view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
   view[i + 4] = HEAPF32[value + (4 * i + 16) >> 2];
   view[i + 5] = HEAPF32[value + (4 * i + 20) >> 2];
   view[i + 6] = HEAPF32[value + (4 * i + 24) >> 2];
   view[i + 7] = HEAPF32[value + (4 * i + 28) >> 2];
   view[i + 8] = HEAPF32[value + (4 * i + 32) >> 2];
   view[i + 9] = HEAPF32[value + (4 * i + 36) >> 2];
   view[i + 10] = HEAPF32[value + (4 * i + 40) >> 2];
   view[i + 11] = HEAPF32[value + (4 * i + 44) >> 2];
   view[i + 12] = HEAPF32[value + (4 * i + 48) >> 2];
   view[i + 13] = HEAPF32[value + (4 * i + 52) >> 2];
   view[i + 14] = HEAPF32[value + (4 * i + 56) >> 2];
   view[i + 15] = HEAPF32[value + (4 * i + 60) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 64 >> 2);
 }
 GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
}

function _emscripten_glUniformMatrix4x2fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix4x2fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix4x2fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix4x2fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 8);
 } else {
  GLctx.uniformMatrix4x2fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 32 >> 2));
 }
}

function _emscripten_glUniformMatrix4x3fv(location, count, transpose, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniformMatrix4x3fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniformMatrix4x3fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniformMatrix4x3fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 12);
 } else {
  GLctx.uniformMatrix4x3fv(GL.uniforms[location], !!transpose, HEAPF32.subarray(value >> 2, value + count * 48 >> 2));
 }
}

function _emscripten_glUnmapBuffer() {
 err("missing function: emscripten_glUnmapBuffer");
 abort(-1);
}

function _emscripten_glUseProgram(program) {
 GL.validateGLObjectID(GL.programs, program, "glUseProgram", "program");
 GLctx.useProgram(GL.programs[program]);
}

function _emscripten_glValidateProgram(program) {
 GL.validateGLObjectID(GL.programs, program, "glValidateProgram", "program");
 GLctx.validateProgram(GL.programs[program]);
}

function _emscripten_glVertexAttrib1f(x0, x1) {
 GLctx["vertexAttrib1f"](x0, x1);
}

function _emscripten_glVertexAttrib1fv(index, v) {
 assert((v & 3) == 0, "Pointer to float data passed to glVertexAttrib1fv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttrib1fv!");
 GLctx.vertexAttrib1f(index, HEAPF32[v >> 2]);
}

function _emscripten_glVertexAttrib2f(x0, x1, x2) {
 GLctx["vertexAttrib2f"](x0, x1, x2);
}

function _emscripten_glVertexAttrib2fv(index, v) {
 assert((v & 3) == 0, "Pointer to float data passed to glVertexAttrib2fv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttrib2fv!");
 GLctx.vertexAttrib2f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2]);
}

function _emscripten_glVertexAttrib3f(x0, x1, x2, x3) {
 GLctx["vertexAttrib3f"](x0, x1, x2, x3);
}

function _emscripten_glVertexAttrib3fv(index, v) {
 assert((v & 3) == 0, "Pointer to float data passed to glVertexAttrib3fv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttrib3fv!");
 GLctx.vertexAttrib3f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2], HEAPF32[v + 8 >> 2]);
}

function _emscripten_glVertexAttrib4f(x0, x1, x2, x3, x4) {
 GLctx["vertexAttrib4f"](x0, x1, x2, x3, x4);
}

function _emscripten_glVertexAttrib4fv(index, v) {
 assert((v & 3) == 0, "Pointer to float data passed to glVertexAttrib4fv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttrib4fv!");
 GLctx.vertexAttrib4f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2], HEAPF32[v + 8 >> 2], HEAPF32[v + 12 >> 2]);
}

function _emscripten_glVertexAttribDivisor(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _emscripten_glVertexAttribDivisorANGLE(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _emscripten_glVertexAttribDivisorARB(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _emscripten_glVertexAttribDivisorEXT(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _emscripten_glVertexAttribDivisorNV(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _emscripten_glVertexAttribI4i(x0, x1, x2, x3, x4) {
 GLctx["vertexAttribI4i"](x0, x1, x2, x3, x4);
}

function _emscripten_glVertexAttribI4iv(index, v) {
 assert((v & 3) == 0, "Pointer to integer data passed to glVertexAttribI4iv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttribI4iv!");
 GLctx.vertexAttribI4i(index, HEAP32[v >> 2], HEAP32[v + 4 >> 2], HEAP32[v + 8 >> 2], HEAP32[v + 12 >> 2]);
}

function _emscripten_glVertexAttribI4ui(x0, x1, x2, x3, x4) {
 GLctx["vertexAttribI4ui"](x0, x1, x2, x3, x4);
}

function _emscripten_glVertexAttribI4uiv(index, v) {
 assert((v & 3) == 0, "Pointer to integer data passed to glVertexAttribI4uiv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttribI4uiv!");
 GLctx.vertexAttribI4ui(index, HEAPU32[v >> 2], HEAPU32[v + 4 >> 2], HEAPU32[v + 8 >> 2], HEAPU32[v + 12 >> 2]);
}

function _emscripten_glVertexAttribIPointer(index, size, type, stride, ptr) {
 GL.validateVertexAttribPointer(size, type, stride, ptr);
 GLctx["vertexAttribIPointer"](index, size, type, stride, ptr);
}

function _emscripten_glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
 GL.validateVertexAttribPointer(size, type, stride, ptr);
 GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

function _emscripten_glViewport(x0, x1, x2, x3) {
 GLctx["viewport"](x0, x1, x2, x3);
}

function _emscripten_glWaitSync(sync, flags, timeoutLo, timeoutHi) {
 timeoutLo = timeoutLo >>> 0;
 timeoutHi = timeoutHi >>> 0;
 var timeout = timeoutLo == 4294967295 && timeoutHi == 4294967295 ? -1 : makeBigInt(timeoutLo, timeoutHi, true);
 GLctx.waitSync(GL.syncs[sync], flags, timeout);
}

function __reallyNegative(x) {
 return x < 0 || x === 0 && 1 / x === -Infinity;
}

function __formatString(format, varargs) {
 assert((varargs & 3) === 0);
 var textIndex = format;
 var argIndex = varargs;
 function prepVararg(ptr, type) {
  if (type === "double" || type === "i64") {
   if (ptr & 7) {
    assert((ptr & 7) === 4);
    ptr += 4;
   }
  } else {
   assert((ptr & 3) === 0);
  }
  return ptr;
 }
 function getNextArg(type) {
  var ret;
  argIndex = prepVararg(argIndex, type);
  if (type === "double") {
   ret = HEAPF64[argIndex >> 3];
   argIndex += 8;
  } else if (type == "i64") {
   ret = [ HEAP32[argIndex >> 2], HEAP32[argIndex + 4 >> 2] ];
   argIndex += 8;
  } else {
   assert((argIndex & 3) === 0);
   type = "i32";
   ret = HEAP32[argIndex >> 2];
   argIndex += 4;
  }
  return ret;
 }
 var ret = [];
 var curr, next, currArg;
 while (1) {
  var startTextIndex = textIndex;
  curr = HEAP8[textIndex >> 0];
  if (curr === 0) break;
  next = HEAP8[textIndex + 1 >> 0];
  if (curr == 37) {
   var flagAlwaysSigned = false;
   var flagLeftAlign = false;
   var flagAlternative = false;
   var flagZeroPad = false;
   var flagPadSign = false;
   flagsLoop: while (1) {
    switch (next) {
    case 43:
     flagAlwaysSigned = true;
     break;

    case 45:
     flagLeftAlign = true;
     break;

    case 35:
     flagAlternative = true;
     break;

    case 48:
     if (flagZeroPad) {
      break flagsLoop;
     } else {
      flagZeroPad = true;
      break;
     }

    case 32:
     flagPadSign = true;
     break;

    default:
     break flagsLoop;
    }
    textIndex++;
    next = HEAP8[textIndex + 1 >> 0];
   }
   var width = 0;
   if (next == 42) {
    width = getNextArg("i32");
    textIndex++;
    next = HEAP8[textIndex + 1 >> 0];
   } else {
    while (next >= 48 && next <= 57) {
     width = width * 10 + (next - 48);
     textIndex++;
     next = HEAP8[textIndex + 1 >> 0];
    }
   }
   var precisionSet = false, precision = -1;
   if (next == 46) {
    precision = 0;
    precisionSet = true;
    textIndex++;
    next = HEAP8[textIndex + 1 >> 0];
    if (next == 42) {
     precision = getNextArg("i32");
     textIndex++;
    } else {
     while (1) {
      var precisionChr = HEAP8[textIndex + 1 >> 0];
      if (precisionChr < 48 || precisionChr > 57) break;
      precision = precision * 10 + (precisionChr - 48);
      textIndex++;
     }
    }
    next = HEAP8[textIndex + 1 >> 0];
   }
   if (precision < 0) {
    precision = 6;
    precisionSet = false;
   }
   var argSize;
   switch (String.fromCharCode(next)) {
   case "h":
    var nextNext = HEAP8[textIndex + 2 >> 0];
    if (nextNext == 104) {
     textIndex++;
     argSize = 1;
    } else {
     argSize = 2;
    }
    break;

   case "l":
    var nextNext = HEAP8[textIndex + 2 >> 0];
    if (nextNext == 108) {
     textIndex++;
     argSize = 8;
    } else {
     argSize = 4;
    }
    break;

   case "L":
   case "q":
   case "j":
    argSize = 8;
    break;

   case "z":
   case "t":
   case "I":
    argSize = 4;
    break;

   default:
    argSize = null;
   }
   if (argSize) textIndex++;
   next = HEAP8[textIndex + 1 >> 0];
   switch (String.fromCharCode(next)) {
   case "d":
   case "i":
   case "u":
   case "o":
   case "x":
   case "X":
   case "p":
    {
     var signed = next == 100 || next == 105;
     argSize = argSize || 4;
     currArg = getNextArg("i" + argSize * 8);
     var argText;
     if (argSize == 8) {
      currArg = makeBigInt(currArg[0], currArg[1], next == 117);
     }
     if (argSize <= 4) {
      var limit = Math.pow(256, argSize) - 1;
      currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
     }
     var currAbsArg = Math.abs(currArg);
     var prefix = "";
     if (next == 100 || next == 105) {
      argText = reSign(currArg, 8 * argSize, 1).toString(10);
     } else if (next == 117) {
      argText = unSign(currArg, 8 * argSize, 1).toString(10);
      currArg = Math.abs(currArg);
     } else if (next == 111) {
      argText = (flagAlternative ? "0" : "") + currAbsArg.toString(8);
     } else if (next == 120 || next == 88) {
      prefix = flagAlternative && currArg != 0 ? "0x" : "";
      if (currArg < 0) {
       currArg = -currArg;
       argText = (currAbsArg - 1).toString(16);
       var buffer = [];
       for (var i = 0; i < argText.length; i++) {
        buffer.push((15 - parseInt(argText[i], 16)).toString(16));
       }
       argText = buffer.join("");
       while (argText.length < argSize * 2) argText = "f" + argText;
      } else {
       argText = currAbsArg.toString(16);
      }
      if (next == 88) {
       prefix = prefix.toUpperCase();
       argText = argText.toUpperCase();
      }
     } else if (next == 112) {
      if (currAbsArg === 0) {
       argText = "(nil)";
      } else {
       prefix = "0x";
       argText = currAbsArg.toString(16);
      }
     }
     if (precisionSet) {
      while (argText.length < precision) {
       argText = "0" + argText;
      }
     }
     if (currArg >= 0) {
      if (flagAlwaysSigned) {
       prefix = "+" + prefix;
      } else if (flagPadSign) {
       prefix = " " + prefix;
      }
     }
     if (argText.charAt(0) == "-") {
      prefix = "-" + prefix;
      argText = argText.substr(1);
     }
     while (prefix.length + argText.length < width) {
      if (flagLeftAlign) {
       argText += " ";
      } else {
       if (flagZeroPad) {
        argText = "0" + argText;
       } else {
        prefix = " " + prefix;
       }
      }
     }
     argText = prefix + argText;
     argText.split("").forEach(function(chr) {
      ret.push(chr.charCodeAt(0));
     });
     break;
    }

   case "f":
   case "F":
   case "e":
   case "E":
   case "g":
   case "G":
    {
     currArg = getNextArg("double");
     var argText;
     if (isNaN(currArg)) {
      argText = "nan";
      flagZeroPad = false;
     } else if (!isFinite(currArg)) {
      argText = (currArg < 0 ? "-" : "") + "inf";
      flagZeroPad = false;
     } else {
      var isGeneral = false;
      var effectivePrecision = Math.min(precision, 20);
      if (next == 103 || next == 71) {
       isGeneral = true;
       precision = precision || 1;
       var exponent = parseInt(currArg.toExponential(effectivePrecision).split("e")[1], 10);
       if (precision > exponent && exponent >= -4) {
        next = (next == 103 ? "f" : "F").charCodeAt(0);
        precision -= exponent + 1;
       } else {
        next = (next == 103 ? "e" : "E").charCodeAt(0);
        precision--;
       }
       effectivePrecision = Math.min(precision, 20);
      }
      if (next == 101 || next == 69) {
       argText = currArg.toExponential(effectivePrecision);
       if (/[eE][-+]\d$/.test(argText)) {
        argText = argText.slice(0, -1) + "0" + argText.slice(-1);
       }
      } else if (next == 102 || next == 70) {
       argText = currArg.toFixed(effectivePrecision);
       if (currArg === 0 && __reallyNegative(currArg)) {
        argText = "-" + argText;
       }
      }
      var parts = argText.split("e");
      if (isGeneral && !flagAlternative) {
       while (parts[0].length > 1 && parts[0].indexOf(".") != -1 && (parts[0].slice(-1) == "0" || parts[0].slice(-1) == ".")) {
        parts[0] = parts[0].slice(0, -1);
       }
      } else {
       if (flagAlternative && argText.indexOf(".") == -1) parts[0] += ".";
       while (precision > effectivePrecision++) parts[0] += "0";
      }
      argText = parts[0] + (parts.length > 1 ? "e" + parts[1] : "");
      if (next == 69) argText = argText.toUpperCase();
      if (currArg >= 0) {
       if (flagAlwaysSigned) {
        argText = "+" + argText;
       } else if (flagPadSign) {
        argText = " " + argText;
       }
      }
     }
     while (argText.length < width) {
      if (flagLeftAlign) {
       argText += " ";
      } else {
       if (flagZeroPad && (argText[0] == "-" || argText[0] == "+")) {
        argText = argText[0] + "0" + argText.slice(1);
       } else {
        argText = (flagZeroPad ? "0" : " ") + argText;
       }
      }
     }
     if (next < 97) argText = argText.toUpperCase();
     argText.split("").forEach(function(chr) {
      ret.push(chr.charCodeAt(0));
     });
     break;
    }

   case "s":
    {
     var arg = getNextArg("i8*");
     var argLength = arg ? _strlen(arg) : "(null)".length;
     if (precisionSet) argLength = Math.min(argLength, precision);
     if (!flagLeftAlign) {
      while (argLength < width--) {
       ret.push(32);
      }
     }
     if (arg) {
      for (var i = 0; i < argLength; i++) {
       ret.push(HEAPU8[arg++ >> 0]);
      }
     } else {
      ret = ret.concat(intArrayFromString("(null)".substr(0, argLength), true));
     }
     if (flagLeftAlign) {
      while (argLength < width--) {
       ret.push(32);
      }
     }
     break;
    }

   case "c":
    {
     if (flagLeftAlign) ret.push(getNextArg("i8"));
     while (--width > 0) {
      ret.push(32);
     }
     if (!flagLeftAlign) ret.push(getNextArg("i8"));
     break;
    }

   case "n":
    {
     var ptr = getNextArg("i32*");
     HEAP32[ptr >> 2] = ret.length;
     break;
    }

   case "%":
    {
     ret.push(curr);
     break;
    }

   default:
    {
     for (var i = startTextIndex; i < textIndex + 2; i++) {
      ret.push(HEAP8[i >> 0]);
     }
    }
   }
   textIndex += 2;
  } else {
   ret.push(curr);
   textIndex += 1;
  }
 }
 return ret;
}

function _emscripten_log_js(flags, str) {
 if (flags & 24) {
  str = str.replace(/\s+$/, "");
  str += (str.length > 0 ? "\n" : "") + _emscripten_get_callstack_js(flags);
 }
 if (flags & 1) {
  if (flags & 4) {
   console.error(str);
  } else if (flags & 2) {
   console.warn(str);
  } else {
   console.log(str);
  }
 } else if (flags & 6) {
  err(str);
 } else {
  out(str);
 }
}

function _emscripten_log(flags, varargs) {
 var format = HEAP32[varargs >> 2];
 varargs += 4;
 var str = "";
 if (format) {
  var result = __formatString(format, varargs);
  for (var i = 0; i < result.length; ++i) {
   str += String.fromCharCode(result[i]);
  }
 }
 _emscripten_log_js(flags, str);
}

function _longjmp(env, value) {
 _setThrew(env, value || 1);
 throw "longjmp";
}

function _emscripten_longjmp(env, value) {
 _longjmp(env, value);
}

function __emscripten_do_request_fullscreen(target, strategy) {
 if (typeof JSEvents.fullscreenEnabled() === "undefined") return -1;
 if (!JSEvents.fullscreenEnabled()) return -3;
 if (!target) target = "#canvas";
 target = __findEventTarget(target);
 if (!target) return -4;
 if (!target.requestFullscreen && !target.msRequestFullscreen && !target.mozRequestFullScreen && !target.mozRequestFullscreen && !target.webkitRequestFullscreen) {
  return -3;
 }
 var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
 if (!canPerformRequests) {
  if (strategy.deferUntilInEventHandler) {
   JSEvents.deferCall(_JSEvents_requestFullscreen, 1, [ target, strategy ]);
   return 1;
  } else {
   return -2;
  }
 }
 return _JSEvents_requestFullscreen(target, strategy);
}

function _emscripten_request_fullscreen_strategy(target, deferUntilInEventHandler, fullscreenStrategy) {
 var strategy = {};
 strategy.scaleMode = HEAP32[fullscreenStrategy >> 2];
 strategy.canvasResolutionScaleMode = HEAP32[fullscreenStrategy + 4 >> 2];
 strategy.filteringMode = HEAP32[fullscreenStrategy + 8 >> 2];
 strategy.deferUntilInEventHandler = deferUntilInEventHandler;
 strategy.canvasResizedCallback = HEAP32[fullscreenStrategy + 12 >> 2];
 strategy.canvasResizedCallbackUserData = HEAP32[fullscreenStrategy + 16 >> 2];
 __currentFullscreenStrategy = strategy;
 return __emscripten_do_request_fullscreen(target, strategy);
}

function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
 if (!target) target = "#canvas";
 target = __findEventTarget(target);
 if (!target) return -4;
 if (!target.requestPointerLock && !target.mozRequestPointerLock && !target.webkitRequestPointerLock && !target.msRequestPointerLock) {
  return -1;
 }
 var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
 if (!canPerformRequests) {
  if (deferUntilInEventHandler) {
   JSEvents.deferCall(__requestPointerLock, 2, [ target ]);
   return 1;
  } else {
   return -2;
  }
 }
 return __requestPointerLock(target);
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("Cannot enlarge memory arrays to size " + requestedSize + " bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + HEAP8.length + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
}

function emscripten_realloc_buffer(size) {
 var PAGE_MULTIPLE = 65536;
 size = alignUp(size, PAGE_MULTIPLE);
 var oldSize = buffer.byteLength;
 try {
  var result = wasmMemory.grow((size - oldSize) / 65536);
  if (result !== (-1 | 0)) {
   buffer = wasmMemory.buffer;
   return true;
  } else {
   return false;
  }
 } catch (e) {
  console.error("emscripten_realloc_buffer: Attempted to grow from " + oldSize + " bytes to " + size + " bytes, but got error: " + e);
  return false;
 }
}

function _emscripten_resize_heap(requestedSize) {
 var oldSize = _emscripten_get_heap_size();
 assert(requestedSize > oldSize);
 var PAGE_MULTIPLE = 65536;
 var LIMIT = 2147483648 - PAGE_MULTIPLE;
 if (requestedSize > LIMIT) {
  err("Cannot enlarge memory, asked to go up to " + requestedSize + " bytes, but the limit is " + LIMIT + " bytes!");
  return false;
 }
 var MIN_TOTAL_MEMORY = 16777216;
 var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
 while (newSize < requestedSize) {
  if (newSize <= 536870912) {
   newSize = alignUp(2 * newSize, PAGE_MULTIPLE);
  } else {
   newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
   if (newSize === oldSize) {
    warnOnce("Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only " + HEAP8.length);
   }
  }
 }
 var start = Date.now();
 if (!emscripten_realloc_buffer(newSize)) {
  err("Failed to grow the heap from " + oldSize + " bytes to " + newSize + " bytes, not enough memory!");
  return false;
 }
 updateGlobalBufferViews();
 return true;
}

function _emscripten_sample_gamepad_data() {
 return (JSEvents.lastGamepadState = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : null) ? 0 : -1;
}

function __registerBeforeUnloadEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString) {
 var beforeUnloadEventHandlerFunc = function(event) {
  var e = event || window.event;
  var confirmationMessage = dynCall_iiii(callbackfunc, eventTypeId, 0, userData);
  if (confirmationMessage) {
   confirmationMessage = UTF8ToString(confirmationMessage);
  }
  if (confirmationMessage) {
   e.preventDefault();
   e.returnValue = confirmationMessage;
   return confirmationMessage;
  }
 };
 var eventHandler = {
  target: __findEventTarget(target),
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: beforeUnloadEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_beforeunload_callback_on_thread(userData, callbackfunc, targetThread) {
 if (typeof window.onbeforeunload === "undefined") return -1;
 if (targetThread !== 1) return -5;
 __registerBeforeUnloadEventCallback(2, userData, true, callbackfunc, 28, "beforeunload");
 return 0;
}

function __registerFocusEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.focusEvent) JSEvents.focusEvent = _malloc(256);
 var focusEventHandlerFunc = function(event) {
  var e = event || window.event;
  var nodeName = JSEvents.getNodeNameForTarget(e.target);
  var id = e.target.id ? e.target.id : "";
  var focusEvent = JSEvents.focusEvent;
  stringToUTF8(nodeName, focusEvent + 0, 128);
  stringToUTF8(id, focusEvent + 128, 128);
  if (dynCall_iiii(callbackfunc, eventTypeId, focusEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: __findEventTarget(target),
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: focusEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_blur_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerFocusEventCallback(target, userData, useCapture, callbackfunc, 12, "blur", targetThread);
 return 0;
}

function __fillMouseEventData(eventStruct, e, target) {
 HEAPF64[eventStruct >> 3] = JSEvents.tick();
 HEAP32[eventStruct + 8 >> 2] = e.screenX;
 HEAP32[eventStruct + 12 >> 2] = e.screenY;
 HEAP32[eventStruct + 16 >> 2] = e.clientX;
 HEAP32[eventStruct + 20 >> 2] = e.clientY;
 HEAP32[eventStruct + 24 >> 2] = e.ctrlKey;
 HEAP32[eventStruct + 28 >> 2] = e.shiftKey;
 HEAP32[eventStruct + 32 >> 2] = e.altKey;
 HEAP32[eventStruct + 36 >> 2] = e.metaKey;
 HEAP16[eventStruct + 40 >> 1] = e.button;
 HEAP16[eventStruct + 42 >> 1] = e.buttons;
 HEAP32[eventStruct + 44 >> 2] = e["movementX"] || e["mozMovementX"] || e["webkitMovementX"] || e.screenX - JSEvents.previousScreenX;
 HEAP32[eventStruct + 48 >> 2] = e["movementY"] || e["mozMovementY"] || e["webkitMovementY"] || e.screenY - JSEvents.previousScreenY;
 if (Module["canvas"]) {
  var rect = Module["canvas"].getBoundingClientRect();
  HEAP32[eventStruct + 60 >> 2] = e.clientX - rect.left;
  HEAP32[eventStruct + 64 >> 2] = e.clientY - rect.top;
 } else {
  HEAP32[eventStruct + 60 >> 2] = 0;
  HEAP32[eventStruct + 64 >> 2] = 0;
 }
 if (target) {
  var rect = JSEvents.getBoundingClientRectOrZeros(target);
  HEAP32[eventStruct + 52 >> 2] = e.clientX - rect.left;
  HEAP32[eventStruct + 56 >> 2] = e.clientY - rect.top;
 } else {
  HEAP32[eventStruct + 52 >> 2] = 0;
  HEAP32[eventStruct + 56 >> 2] = 0;
 }
 if (e.type !== "wheel" && e.type !== "mousewheel") {
  JSEvents.previousScreenX = e.screenX;
  JSEvents.previousScreenY = e.screenY;
 }
}

function __registerMouseEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(72);
 target = __findEventTarget(target);
 var mouseEventHandlerFunc = function(event) {
  var e = event || window.event;
  __fillMouseEventData(JSEvents.mouseEvent, e, target);
  if (dynCall_iiii(callbackfunc, eventTypeId, JSEvents.mouseEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: mouseEventHandlerFunc,
  useCapture: useCapture
 };
 if (JSEvents.isInternetExplorer() && eventTypeString == "mousedown") eventHandler.allowsDeferredCalls = false;
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_click_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 4, "click", targetThread);
 return 0;
}

function _emscripten_set_element_css_size(target, width, height) {
 target = target ? __findEventTarget(target) : Module["canvas"];
 if (!target) return -4;
 target.style.width = width + "px";
 target.style.height = height + "px";
 return 0;
}

function _emscripten_set_focus_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerFocusEventCallback(target, userData, useCapture, callbackfunc, 13, "focus", targetThread);
 return 0;
}

function __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.fullscreenChangeEvent) JSEvents.fullscreenChangeEvent = _malloc(280);
 var fullscreenChangeEventhandlerFunc = function(event) {
  var e = event || window.event;
  var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;
  __fillFullscreenChangeEventData(fullscreenChangeEvent, e);
  if (dynCall_iiii(callbackfunc, eventTypeId, fullscreenChangeEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: fullscreenChangeEventhandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_fullscreenchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 if (typeof JSEvents.fullscreenEnabled() === "undefined") return -1;
 target = target ? __findEventTarget(target) : __specialEventTargets[1];
 if (!target) return -4;
 __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "fullscreenchange", targetThread);
 __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "mozfullscreenchange", targetThread);
 __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "webkitfullscreenchange", targetThread);
 __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "msfullscreenchange", targetThread);
 return 0;
}

function __registerGamepadEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.gamepadEvent) JSEvents.gamepadEvent = _malloc(1432);
 var gamepadEventHandlerFunc = function(event) {
  var e = event || window.event;
  var gamepadEvent = JSEvents.gamepadEvent;
  __fillGamepadEventData(gamepadEvent, e.gamepad);
  if (dynCall_iiii(callbackfunc, eventTypeId, gamepadEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: __findEventTarget(target),
  allowsDeferredCalls: true,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: gamepadEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_gamepadconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
 if (!navigator.getGamepads && !navigator.webkitGetGamepads) return -1;
 __registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 26, "gamepadconnected", targetThread);
 return 0;
}

function _emscripten_set_gamepaddisconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
 if (!navigator.getGamepads && !navigator.webkitGetGamepads) return -1;
 __registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 27, "gamepaddisconnected", targetThread);
 return 0;
}

function __registerKeyEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.keyEvent) JSEvents.keyEvent = _malloc(164);
 var keyEventHandlerFunc = function(event) {
  var e = event || window.event;
  var keyEventData = JSEvents.keyEvent;
  stringToUTF8(e.key ? e.key : "", keyEventData + 0, 32);
  stringToUTF8(e.code ? e.code : "", keyEventData + 32, 32);
  HEAP32[keyEventData + 64 >> 2] = e.location;
  HEAP32[keyEventData + 68 >> 2] = e.ctrlKey;
  HEAP32[keyEventData + 72 >> 2] = e.shiftKey;
  HEAP32[keyEventData + 76 >> 2] = e.altKey;
  HEAP32[keyEventData + 80 >> 2] = e.metaKey;
  HEAP32[keyEventData + 84 >> 2] = e.repeat;
  stringToUTF8(e.locale ? e.locale : "", keyEventData + 88, 32);
  stringToUTF8(e.char ? e.char : "", keyEventData + 120, 32);
  HEAP32[keyEventData + 152 >> 2] = e.charCode;
  HEAP32[keyEventData + 156 >> 2] = e.keyCode;
  HEAP32[keyEventData + 160 >> 2] = e.which;
  if (dynCall_iiii(callbackfunc, eventTypeId, keyEventData, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: __findEventTarget(target),
  allowsDeferredCalls: JSEvents.isInternetExplorer() ? false : true,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: keyEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
 return 0;
}

function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
 return 0;
}

function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
 return 0;
}

function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
 return 0;
}

function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
 return 0;
}

function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
 return 0;
}

function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
 return 0;
}

function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
 return 0;
}

function __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.pointerlockChangeEvent) JSEvents.pointerlockChangeEvent = _malloc(260);
 var pointerlockChangeEventHandlerFunc = function(event) {
  var e = event || window.event;
  var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
  __fillPointerlockChangeEventData(pointerlockChangeEvent, e);
  if (dynCall_iiii(callbackfunc, eventTypeId, pointerlockChangeEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: pointerlockChangeEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 if (!document || !document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
  return -1;
 }
 target = target ? __findEventTarget(target) : __specialEventTargets[1];
 if (!target) return -4;
 __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
 __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mozpointerlockchange", targetThread);
 __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "webkitpointerlockchange", targetThread);
 __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mspointerlockchange", targetThread);
 return 0;
}

function __registerUiEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.uiEvent) JSEvents.uiEvent = _malloc(36);
 if (eventTypeString == "scroll" && !target) {
  target = document;
 } else {
  target = __findEventTarget(target);
 }
 var uiEventHandlerFunc = function(event) {
  var e = event || window.event;
  if (e.target != target) {
   return;
  }
  var scrollPos = JSEvents.pageScrollPos();
  var uiEvent = JSEvents.uiEvent;
  HEAP32[uiEvent >> 2] = e.detail;
  HEAP32[uiEvent + 4 >> 2] = document.body.clientWidth;
  HEAP32[uiEvent + 8 >> 2] = document.body.clientHeight;
  HEAP32[uiEvent + 12 >> 2] = window.innerWidth;
  HEAP32[uiEvent + 16 >> 2] = window.innerHeight;
  HEAP32[uiEvent + 20 >> 2] = window.outerWidth;
  HEAP32[uiEvent + 24 >> 2] = window.outerHeight;
  HEAP32[uiEvent + 28 >> 2] = scrollPos[0];
  HEAP32[uiEvent + 32 >> 2] = scrollPos[1];
  if (dynCall_iiii(callbackfunc, eventTypeId, uiEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: uiEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
 return 0;
}

function __registerTouchEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.touchEvent) JSEvents.touchEvent = _malloc(1684);
 target = __findEventTarget(target);
 var touchEventHandlerFunc = function(event) {
  var e = event || window.event;
  var touches = {};
  for (var i = 0; i < e.touches.length; ++i) {
   var touch = e.touches[i];
   touches[touch.identifier] = touch;
  }
  for (var i = 0; i < e.changedTouches.length; ++i) {
   var touch = e.changedTouches[i];
   touches[touch.identifier] = touch;
   touch.changed = true;
  }
  for (var i = 0; i < e.targetTouches.length; ++i) {
   var touch = e.targetTouches[i];
   touches[touch.identifier].onTarget = true;
  }
  var touchEvent = JSEvents.touchEvent;
  var ptr = touchEvent;
  HEAP32[ptr + 4 >> 2] = e.ctrlKey;
  HEAP32[ptr + 8 >> 2] = e.shiftKey;
  HEAP32[ptr + 12 >> 2] = e.altKey;
  HEAP32[ptr + 16 >> 2] = e.metaKey;
  ptr += 20;
  var canvasRect = Module["canvas"] ? Module["canvas"].getBoundingClientRect() : undefined;
  var targetRect = JSEvents.getBoundingClientRectOrZeros(target);
  var numTouches = 0;
  for (var i in touches) {
   var t = touches[i];
   HEAP32[ptr >> 2] = t.identifier;
   HEAP32[ptr + 4 >> 2] = t.screenX;
   HEAP32[ptr + 8 >> 2] = t.screenY;
   HEAP32[ptr + 12 >> 2] = t.clientX;
   HEAP32[ptr + 16 >> 2] = t.clientY;
   HEAP32[ptr + 20 >> 2] = t.pageX;
   HEAP32[ptr + 24 >> 2] = t.pageY;
   HEAP32[ptr + 28 >> 2] = t.changed;
   HEAP32[ptr + 32 >> 2] = t.onTarget;
   if (canvasRect) {
    HEAP32[ptr + 44 >> 2] = t.clientX - canvasRect.left;
    HEAP32[ptr + 48 >> 2] = t.clientY - canvasRect.top;
   } else {
    HEAP32[ptr + 44 >> 2] = 0;
    HEAP32[ptr + 48 >> 2] = 0;
   }
   HEAP32[ptr + 36 >> 2] = t.clientX - targetRect.left;
   HEAP32[ptr + 40 >> 2] = t.clientY - targetRect.top;
   ptr += 52;
   if (++numTouches >= 32) {
    break;
   }
  }
  HEAP32[touchEvent >> 2] = numTouches;
  if (dynCall_iiii(callbackfunc, eventTypeId, touchEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: touchEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
 return 0;
}

function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
 return 0;
}

function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
 return 0;
}

function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
 return 0;
}

function __fillVisibilityChangeEventData(eventStruct, e) {
 var visibilityStates = [ "hidden", "visible", "prerender", "unloaded" ];
 var visibilityState = visibilityStates.indexOf(document.visibilityState);
 HEAP32[eventStruct >> 2] = document.hidden;
 HEAP32[eventStruct + 4 >> 2] = visibilityState;
}

function __registerVisibilityChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.visibilityChangeEvent) JSEvents.visibilityChangeEvent = _malloc(8);
 var visibilityChangeEventHandlerFunc = function(event) {
  var e = event || window.event;
  var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
  __fillVisibilityChangeEventData(visibilityChangeEvent, e);
  if (dynCall_iiii(callbackfunc, eventTypeId, visibilityChangeEvent, userData)) e.preventDefault();
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: false,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: visibilityChangeEventHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_visibilitychange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
 if (!__specialEventTargets[1]) {
  return -4;
 }
 __registerVisibilityChangeEventCallback(__specialEventTargets[1], userData, useCapture, callbackfunc, 21, "visibilitychange", targetThread);
 return 0;
}

function __registerWheelEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
 if (!JSEvents.wheelEvent) JSEvents.wheelEvent = _malloc(104);
 var wheelHandlerFunc = function(event) {
  var e = event || window.event;
  var wheelEvent = JSEvents.wheelEvent;
  __fillMouseEventData(wheelEvent, e, target);
  HEAPF64[wheelEvent + 72 >> 3] = e["deltaX"];
  HEAPF64[wheelEvent + 80 >> 3] = e["deltaY"];
  HEAPF64[wheelEvent + 88 >> 3] = e["deltaZ"];
  HEAP32[wheelEvent + 96 >> 2] = e["deltaMode"];
  if (dynCall_iiii(callbackfunc, eventTypeId, wheelEvent, userData)) e.preventDefault();
 };
 var mouseWheelHandlerFunc = function(event) {
  var e = event || window.event;
  __fillMouseEventData(JSEvents.wheelEvent, e, target);
  HEAPF64[JSEvents.wheelEvent + 72 >> 3] = e["wheelDeltaX"] || 0;
  HEAPF64[JSEvents.wheelEvent + 80 >> 3] = -(e["wheelDeltaY"] ? e["wheelDeltaY"] : e["wheelDelta"]);
  HEAPF64[JSEvents.wheelEvent + 88 >> 3] = 0;
  HEAP32[JSEvents.wheelEvent + 96 >> 2] = 0;
  var shouldCancel = dynCall_iiii(callbackfunc, eventTypeId, JSEvents.wheelEvent, userData);
  if (shouldCancel) {
   e.preventDefault();
  }
 };
 var eventHandler = {
  target: target,
  allowsDeferredCalls: true,
  eventTypeString: eventTypeString,
  callbackfunc: callbackfunc,
  handlerFunc: eventTypeString == "wheel" ? wheelHandlerFunc : mouseWheelHandlerFunc,
  useCapture: useCapture
 };
 JSEvents.registerOrRemoveHandler(eventHandler);
}

function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
 target = __findEventTarget(target);
 if (typeof target.onwheel !== "undefined") {
  __registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
  return 0;
 } else if (typeof target.onmousewheel !== "undefined") {
  __registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "mousewheel", targetThread);
  return 0;
 } else {
  return -1;
 }
}

var __emscripten_webgl_power_preferences = [ "default", "low-power", "high-performance" ];

function _emscripten_webgl_do_create_context(target, attributes) {
 var contextAttributes = {};
 var a = attributes >> 2;
 contextAttributes["alpha"] = !!HEAP32[a + (0 >> 2)];
 contextAttributes["depth"] = !!HEAP32[a + (4 >> 2)];
 contextAttributes["stencil"] = !!HEAP32[a + (8 >> 2)];
 contextAttributes["antialias"] = !!HEAP32[a + (12 >> 2)];
 contextAttributes["premultipliedAlpha"] = !!HEAP32[a + (16 >> 2)];
 contextAttributes["preserveDrawingBuffer"] = !!HEAP32[a + (20 >> 2)];
 var powerPreference = HEAP32[a + (24 >> 2)];
 contextAttributes["powerPreference"] = __emscripten_webgl_power_preferences[powerPreference];
 contextAttributes["failIfMajorPerformanceCaveat"] = !!HEAP32[a + (28 >> 2)];
 contextAttributes.majorVersion = HEAP32[a + (32 >> 2)];
 contextAttributes.minorVersion = HEAP32[a + (36 >> 2)];
 contextAttributes.enableExtensionsByDefault = HEAP32[a + (40 >> 2)];
 contextAttributes.explicitSwapControl = HEAP32[a + (44 >> 2)];
 contextAttributes.proxyContextToMainThread = HEAP32[a + (48 >> 2)];
 contextAttributes.renderViaOffscreenBackBuffer = HEAP32[a + (52 >> 2)];
 var canvas = __findCanvasEventTarget(target);
 var targetStr = UTF8ToString(target);
 if (!canvas) {
  console.error('emscripten_webgl_create_context failed: Unknown canvas target "' + targetStr + '"!');
  return 0;
 }
 if (contextAttributes.explicitSwapControl) {
  console.error("emscripten_webgl_create_context failed: explicitSwapControl is not supported, please rebuild with -s OFFSCREENCANVAS_SUPPORT=1 to enable targeting the experimental OffscreenCanvas specification, or rebuild with -s OFFSCREEN_FRAMEBUFFER=1 to emulate explicitSwapControl in the absence of OffscreenCanvas support!");
  return 0;
 }
 var contextHandle = GL.createContext(canvas, contextAttributes);
 return contextHandle;
}

function _emscripten_webgl_create_context(a0, a1) {
 return _emscripten_webgl_do_create_context(a0, a1);
}

function _emscripten_webgl_destroy_context_calling_thread(contextHandle) {
 if (GL.currentContext == contextHandle) GL.currentContext = 0;
 GL.deleteContext(contextHandle);
}

function _emscripten_webgl_destroy_context(a0) {
 return _emscripten_webgl_destroy_context_calling_thread(a0);
}

function _emscripten_webgl_do_get_current_context() {
 return GL.currentContext ? GL.currentContext.handle : 0;
}

function _emscripten_webgl_get_current_context() {
 return _emscripten_webgl_do_get_current_context();
}

Module["_emscripten_webgl_get_current_context"] = _emscripten_webgl_get_current_context;

function _emscripten_webgl_init_context_attributes(attributes) {
 var a = attributes >> 2;
 for (var i = 0; i < 56 >> 2; ++i) {
  HEAP32[a + i] = 0;
 }
 HEAP32[a + (0 >> 2)] = HEAP32[a + (4 >> 2)] = HEAP32[a + (12 >> 2)] = HEAP32[a + (16 >> 2)] = HEAP32[a + (32 >> 2)] = HEAP32[a + (40 >> 2)] = 1;
}

function _emscripten_webgl_make_context_current(contextHandle) {
 var success = GL.makeContextCurrent(contextHandle);
 return success ? 0 : -5;
}

Module["_emscripten_webgl_make_context_current"] = _emscripten_webgl_make_context_current;

function _exit(status) {
 exit(status);
}

function _getaddrinfo(node, service, hint, out) {
 var addr = 0;
 var port = 0;
 var flags = 0;
 var family = 0;
 var type = 0;
 var proto = 0;
 var ai;
 function allocaddrinfo(family, type, proto, canon, addr, port) {
  var sa, salen, ai;
  var res;
  salen = family === 10 ? 28 : 16;
  addr = family === 10 ? __inet_ntop6_raw(addr) : __inet_ntop4_raw(addr);
  sa = _malloc(salen);
  res = __write_sockaddr(sa, family, addr, port);
  assert(!res.errno);
  ai = _malloc(32);
  HEAP32[ai + 4 >> 2] = family;
  HEAP32[ai + 8 >> 2] = type;
  HEAP32[ai + 12 >> 2] = proto;
  HEAP32[ai + 24 >> 2] = canon;
  HEAP32[ai + 20 >> 2] = sa;
  if (family === 10) {
   HEAP32[ai + 16 >> 2] = 28;
  } else {
   HEAP32[ai + 16 >> 2] = 16;
  }
  HEAP32[ai + 28 >> 2] = 0;
  return ai;
 }
 if (hint) {
  flags = HEAP32[hint >> 2];
  family = HEAP32[hint + 4 >> 2];
  type = HEAP32[hint + 8 >> 2];
  proto = HEAP32[hint + 12 >> 2];
 }
 if (type && !proto) {
  proto = type === 2 ? 17 : 6;
 }
 if (!type && proto) {
  type = proto === 17 ? 2 : 1;
 }
 if (proto === 0) {
  proto = 6;
 }
 if (type === 0) {
  type = 1;
 }
 if (!node && !service) {
  return -2;
 }
 if (flags & ~(1 | 2 | 4 | 1024 | 8 | 16 | 32)) {
  return -1;
 }
 if (hint !== 0 && HEAP32[hint >> 2] & 2 && !node) {
  return -1;
 }
 if (flags & 32) {
  return -2;
 }
 if (type !== 0 && type !== 1 && type !== 2) {
  return -7;
 }
 if (family !== 0 && family !== 2 && family !== 10) {
  return -6;
 }
 if (service) {
  service = UTF8ToString(service);
  port = parseInt(service, 10);
  if (isNaN(port)) {
   if (flags & 1024) {
    return -2;
   }
   return -8;
  }
 }
 if (!node) {
  if (family === 0) {
   family = 2;
  }
  if ((flags & 1) === 0) {
   if (family === 2) {
    addr = _htonl(2130706433);
   } else {
    addr = [ 0, 0, 0, 1 ];
   }
  }
  ai = allocaddrinfo(family, type, proto, null, addr, port);
  HEAP32[out >> 2] = ai;
  return 0;
 }
 node = UTF8ToString(node);
 addr = __inet_pton4_raw(node);
 if (addr !== null) {
  if (family === 0 || family === 2) {
   family = 2;
  } else if (family === 10 && flags & 8) {
   addr = [ 0, 0, _htonl(65535), addr ];
   family = 10;
  } else {
   return -2;
  }
 } else {
  addr = __inet_pton6_raw(node);
  if (addr !== null) {
   if (family === 0 || family === 10) {
    family = 10;
   } else {
    return -2;
   }
  }
 }
 if (addr != null) {
  ai = allocaddrinfo(family, type, proto, node, addr, port);
  HEAP32[out >> 2] = ai;
  return 0;
 }
 if (flags & 4) {
  return -2;
 }
 node = DNS.lookup_name(node);
 addr = __inet_pton4_raw(node);
 if (family === 0) {
  family = 2;
 } else if (family === 10) {
  addr = [ 0, 0, _htonl(65535), addr ];
 }
 ai = allocaddrinfo(family, type, proto, null, addr, port);
 HEAP32[out >> 2] = ai;
 return 0;
}

function _getenv(name) {
 if (name === 0) return 0;
 name = UTF8ToString(name);
 if (!ENV.hasOwnProperty(name)) return 0;
 if (_getenv.ret) _free(_getenv.ret);
 _getenv.ret = allocateUTF8(ENV[name]);
 return _getenv.ret;
}

function _gethostbyname(name) {
 name = UTF8ToString(name);
 var ret = _malloc(20);
 var nameBuf = _malloc(name.length + 1);
 stringToUTF8(name, nameBuf, name.length + 1);
 HEAP32[ret >> 2] = nameBuf;
 var aliasesBuf = _malloc(4);
 HEAP32[aliasesBuf >> 2] = 0;
 HEAP32[ret + 4 >> 2] = aliasesBuf;
 var afinet = 2;
 HEAP32[ret + 8 >> 2] = afinet;
 HEAP32[ret + 12 >> 2] = 4;
 var addrListBuf = _malloc(12);
 HEAP32[addrListBuf >> 2] = addrListBuf + 8;
 HEAP32[addrListBuf + 4 >> 2] = 0;
 HEAP32[addrListBuf + 8 >> 2] = __inet_pton4_raw(DNS.lookup_name(name));
 HEAP32[ret + 16 >> 2] = addrListBuf;
 return ret;
}

function _gethostbyaddr(addr, addrlen, type) {
 if (type !== 2) {
  ___setErrNo(97);
  return null;
 }
 addr = HEAP32[addr >> 2];
 var host = __inet_ntop4_raw(addr);
 var lookup = DNS.lookup_addr(host);
 if (lookup) {
  host = lookup;
 }
 var hostp = allocate(intArrayFromString(host), "i8", ALLOC_STACK);
 return _gethostbyname(hostp);
}

function _getnameinfo(sa, salen, node, nodelen, serv, servlen, flags) {
 var info = __read_sockaddr(sa, salen);
 if (info.errno) {
  return -6;
 }
 var port = info.port;
 var addr = info.addr;
 var overflowed = false;
 if (node && nodelen) {
  var lookup;
  if (flags & 1 || !(lookup = DNS.lookup_addr(addr))) {
   if (flags & 8) {
    return -2;
   }
  } else {
   addr = lookup;
  }
  var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
  if (numBytesWrittenExclNull + 1 >= nodelen) {
   overflowed = true;
  }
 }
 if (serv && servlen) {
  port = "" + port;
  var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
  if (numBytesWrittenExclNull + 1 >= servlen) {
   overflowed = true;
  }
 }
 if (overflowed) {
  return -12;
 }
 return 0;
}

function _gettimeofday(ptr) {
 var now = Date.now();
 HEAP32[ptr >> 2] = now / 1e3 | 0;
 HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;
 return 0;
}

function _glActiveTexture(x0) {
 GLctx["activeTexture"](x0);
}

function _glAttachShader(program, shader) {
 GL.validateGLObjectID(GL.programs, program, "glAttachShader", "program");
 GL.validateGLObjectID(GL.shaders, shader, "glAttachShader", "shader");
 GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}

function _glBindAttribLocation(program, index, name) {
 GL.validateGLObjectID(GL.programs, program, "glBindAttribLocation", "program");
 GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}

function _glBindBuffer(target, buffer) {
 GL.validateGLObjectID(GL.buffers, buffer, "glBindBuffer", "buffer");
 if (target == 35051) {
  GLctx.currentPixelPackBufferBinding = buffer;
 } else if (target == 35052) {
  GLctx.currentPixelUnpackBufferBinding = buffer;
 }
 GLctx.bindBuffer(target, GL.buffers[buffer]);
}

function _glBindBufferRange(target, index, buffer, offset, ptrsize) {
 GL.validateGLObjectID(GL.buffers, buffer, "glBindBufferRange", "buffer");
 GLctx["bindBufferRange"](target, index, GL.buffers[buffer], offset, ptrsize);
}

function _glBindFramebuffer(target, framebuffer) {
 GL.validateGLObjectID(GL.framebuffers, framebuffer, "glBindFramebuffer", "framebuffer");
 GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
}

function _glBindRenderbuffer(target, renderbuffer) {
 GL.validateGLObjectID(GL.renderbuffers, renderbuffer, "glBindRenderbuffer", "renderbuffer");
 GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
}

function _glBindTexture(target, texture) {
 GL.validateGLObjectID(GL.textures, texture, "glBindTexture", "texture");
 GLctx.bindTexture(target, GL.textures[texture]);
}

function _glBlendEquation(x0) {
 GLctx["blendEquation"](x0);
}

function _glBlendEquationSeparate(x0, x1) {
 GLctx["blendEquationSeparate"](x0, x1);
}

function _glBlendFunc(x0, x1) {
 GLctx["blendFunc"](x0, x1);
}

function _glBlendFuncSeparate(x0, x1, x2, x3) {
 GLctx["blendFuncSeparate"](x0, x1, x2, x3);
}

function _glBlitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) {
 GLctx["blitFramebuffer"](x0, x1, x2, x3, x4, x5, x6, x7, x8, x9);
}

function _glBufferData(target, size, data, usage) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (data) {
   GLctx.bufferData(target, HEAPU8, usage, data, size);
  } else {
   GLctx.bufferData(target, size, usage);
  }
 } else {
  GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage);
 }
}

function _glBufferSubData(target, offset, size, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.bufferSubData(target, offset, HEAPU8, data, size);
  return;
 }
 GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
}

function _glCheckFramebufferStatus(x0) {
 return GLctx["checkFramebufferStatus"](x0);
}

function _glClear(x0) {
 GLctx["clear"](x0);
}

function _glClearBufferfi(x0, x1, x2, x3) {
 GLctx["clearBufferfi"](x0, x1, x2, x3);
}

function _glClearBufferfv(buffer, drawbuffer, value) {
 assert((value & 3) == 0, "Pointer to float data passed to glClearBufferfv must be aligned to four bytes!");
 GLctx["clearBufferfv"](buffer, drawbuffer, HEAPF32, value >> 2);
}

function _glClearBufferiv(buffer, drawbuffer, value) {
 assert((value & 3) == 0, "Pointer to integer data passed to glClearBufferiv must be aligned to four bytes!");
 GLctx["clearBufferiv"](buffer, drawbuffer, HEAP32, value >> 2);
}

function _glClearColor(x0, x1, x2, x3) {
 GLctx["clearColor"](x0, x1, x2, x3);
}

function _glClearDepthf(x0) {
 GLctx["clearDepth"](x0);
}

function _glClearStencil(x0) {
 GLctx["clearStencil"](x0);
}

function _glColorMask(red, green, blue, alpha) {
 GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
}

function _glCompileShader(shader) {
 GL.validateGLObjectID(GL.shaders, shader, "glCompileShader", "shader");
 GLctx.compileShader(GL.shaders[shader]);
 var log = (GLctx.getShaderInfoLog(GL.shaders[shader]) || "").trim();
 if (log) console.error("glCompileShader: " + log);
}

function _glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, imageSize, data);
  } else {
   GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, HEAPU8, data, imageSize);
  }
  return;
 }
 GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, data ? HEAPU8.subarray(data, data + imageSize) : null);
}

function _glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, imageSize, data);
  } else {
   GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, HEAPU8, data, imageSize);
  }
  return;
 }
 GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, data ? HEAPU8.subarray(data, data + imageSize) : null);
}

function _glCreateProgram() {
 var id = GL.getNewId(GL.programs);
 var program = GLctx.createProgram();
 program.name = id;
 GL.programs[id] = program;
 return id;
}

function _glCreateShader(shaderType) {
 var id = GL.getNewId(GL.shaders);
 GL.shaders[id] = GLctx.createShader(shaderType);
 return id;
}

function _glCullFace(x0) {
 GLctx["cullFace"](x0);
}

function _glDeleteBuffers(n, buffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[buffers + i * 4 >> 2];
  var buffer = GL.buffers[id];
  if (!buffer) continue;
  if (!GLctx) continue;
  GLctx.deleteBuffer(buffer);
  buffer.name = 0;
  GL.buffers[id] = null;
  if (id == GL.currArrayBuffer) GL.currArrayBuffer = 0;
  if (id == GL.currElementArrayBuffer) GL.currElementArrayBuffer = 0;
  if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
  if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
 }
}

function _glDeleteFramebuffers(n, framebuffers) {
 for (var i = 0; i < n; ++i) {
  var id = HEAP32[framebuffers + i * 4 >> 2];
  var framebuffer = GL.framebuffers[id];
  if (!framebuffer) continue;
  GLctx.deleteFramebuffer(framebuffer);
  framebuffer.name = 0;
  GL.framebuffers[id] = null;
 }
}

function _glDeleteProgram(id) {
 if (!id) return;
 var program = GL.programs[id];
 if (!program) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteProgram(program);
 program.name = 0;
 GL.programs[id] = null;
 GL.programInfos[id] = null;
}

function _glDeleteRenderbuffers(n, renderbuffers) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[renderbuffers + i * 4 >> 2];
  var renderbuffer = GL.renderbuffers[id];
  if (!renderbuffer) continue;
  GLctx.deleteRenderbuffer(renderbuffer);
  renderbuffer.name = 0;
  GL.renderbuffers[id] = null;
 }
}

function _glDeleteShader(id) {
 if (!id) return;
 var shader = GL.shaders[id];
 if (!shader) {
  GL.recordError(1281);
  return;
 }
 GLctx.deleteShader(shader);
 GL.shaders[id] = null;
}

function _glDeleteTextures(n, textures) {
 for (var i = 0; i < n; i++) {
  var id = HEAP32[textures + i * 4 >> 2];
  var texture = GL.textures[id];
  if (!texture) continue;
  GLctx.deleteTexture(texture);
  texture.name = 0;
  GL.textures[id] = null;
 }
}

function _glDepthFunc(x0) {
 GLctx["depthFunc"](x0);
}

function _glDepthMask(flag) {
 GLctx.depthMask(!!flag);
}

function _glDepthRangef(x0, x1) {
 GLctx["depthRange"](x0, x1);
}

function _glDisable(x0) {
 GLctx["disable"](x0);
}

function _glDisableVertexAttribArray(index) {
 GLctx.disableVertexAttribArray(index);
}

function _glDrawArrays(mode, first, count) {
 GLctx.drawArrays(mode, first, count);
}

function _glDrawArraysInstanced(mode, first, count, primcount) {
 assert(GLctx["drawArraysInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawArraysInstanced"](mode, first, count, primcount);
}

function _glDrawBuffers(n, bufs) {
 assert(GLctx["drawBuffers"], "Must have WebGL2 or WEBGL_draw_buffers extension to use drawBuffers");
 assert(n < __tempFixedLengthArray.length, "Invalid count of numBuffers=" + n + " passed to glDrawBuffers (that many draw buffer points do not exist in GL)");
 var bufArray = __tempFixedLengthArray[n];
 for (var i = 0; i < n; i++) {
  bufArray[i] = HEAP32[bufs + i * 4 >> 2];
 }
 GLctx["drawBuffers"](bufArray);
}

function _glDrawElementsInstanced(mode, count, type, indices, primcount) {
 assert(GLctx["drawElementsInstanced"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["drawElementsInstanced"](mode, count, type, indices, primcount);
}

function _glEnable(x0) {
 GLctx["enable"](x0);
}

function _glEnableVertexAttribArray(index) {
 GLctx.enableVertexAttribArray(index);
}

function _glFlush() {
 GLctx["flush"]();
}

function _glFramebufferRenderbuffer(target, attachment, renderbuffertarget, renderbuffer) {
 GL.validateGLObjectID(GL.renderbuffers, renderbuffer, "glFramebufferRenderbuffer", "renderbuffer");
 GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
}

function _glFramebufferTexture2D(target, attachment, textarget, texture, level) {
 GL.validateGLObjectID(GL.textures, texture, "glFramebufferTexture2D", "texture");
 GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
}

function _glGenBuffers(n, buffers) {
 __glGenObject(n, buffers, "createBuffer", GL.buffers, "glGenBuffers");
}

function _glGenFramebuffers(n, ids) {
 __glGenObject(n, ids, "createFramebuffer", GL.framebuffers, "glGenFramebuffers");
}

function _glGenRenderbuffers(n, renderbuffers) {
 __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers, "glGenRenderbuffers");
}

function _glGenTextures(n, textures) {
 __glGenObject(n, textures, "createTexture", GL.textures, "glGenTextures");
}

function _glGetBooleanv(name_, p) {
 emscriptenWebGLGet(name_, p, "Boolean");
}

function _glGetError() {
 if (GL.lastError) {
  var error = GL.lastError;
  GL.lastError = 0;
  return error;
 } else {
  return GLctx.getError();
 }
}

function _glGetIntegerv(name_, p) {
 emscriptenWebGLGet(name_, p, "Integer");
}

function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
 GL.validateGLObjectID(GL.programs, program, "glGetProgramInfoLog", "program");
 var log = GLctx.getProgramInfoLog(GL.programs[program]);
 if (log === null) log = "(unknown error)";
 if (maxLength > 0 && infoLog) {
  var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _glGetProgramiv(program, pname, p) {
 if (!p) {
  err("GL_INVALID_VALUE in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.programs, program, "glGetProgramiv", "program");
 if (program >= GL.counter) {
  err("GL_INVALID_VALUE in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0x" + p.toString(16) + "): The specified program object name was not generated by GL!");
  GL.recordError(1281);
  return;
 }
 var ptable = GL.programInfos[program];
 if (!ptable) {
  err("GL_INVALID_OPERATION in glGetProgramiv(program=" + program + ", pname=" + pname + ", p=0x" + p.toString(16) + "): The specified GL object name does not refer to a program object!");
  GL.recordError(1282);
  return;
 }
 if (pname == 35716) {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  HEAP32[p >> 2] = log.length + 1;
 } else if (pname == 35719) {
  HEAP32[p >> 2] = ptable.maxUniformLength;
 } else if (pname == 35722) {
  if (ptable.maxAttributeLength == -1) {
   program = GL.programs[program];
   var numAttribs = GLctx.getProgramParameter(program, 35721);
   ptable.maxAttributeLength = 0;
   for (var i = 0; i < numAttribs; ++i) {
    var activeAttrib = GLctx.getActiveAttrib(program, i);
    ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxAttributeLength;
 } else if (pname == 35381) {
  if (ptable.maxUniformBlockNameLength == -1) {
   program = GL.programs[program];
   var numBlocks = GLctx.getProgramParameter(program, 35382);
   ptable.maxUniformBlockNameLength = 0;
   for (var i = 0; i < numBlocks; ++i) {
    var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
    ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1);
   }
  }
  HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
 } else {
  HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
 }
}

function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
 GL.validateGLObjectID(GL.shaders, shader, "glGetShaderInfoLog", "shader");
 var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
 if (log === null) log = "(unknown error)";
 if (maxLength > 0 && infoLog) {
  var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
  if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
 } else {
  if (length) HEAP32[length >> 2] = 0;
 }
}

function _glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
 var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
 HEAP32[range >> 2] = result.rangeMin;
 HEAP32[range + 4 >> 2] = result.rangeMax;
 HEAP32[precision >> 2] = result.precision;
}

function _glGetShaderiv(shader, pname, p) {
 if (!p) {
  err("GL_INVALID_VALUE in glGetShaderiv(shader=" + shader + ", pname=" + pname + ", p=0): Function called with null out pointer!");
  GL.recordError(1281);
  return;
 }
 GL.validateGLObjectID(GL.shaders, shader, "glGetShaderiv", "shader");
 if (pname == 35716) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  HEAP32[p >> 2] = log.length + 1;
 } else if (pname == 35720) {
  var source = GLctx.getShaderSource(GL.shaders[shader]);
  var sourceLength = source === null || source.length == 0 ? 0 : source.length + 1;
  HEAP32[p >> 2] = sourceLength;
 } else {
  HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
 }
}

function _glGetString(name_) {
 if (GL.stringCache[name_]) return GL.stringCache[name_];
 var ret;
 switch (name_) {
 case 7939:
  var exts = GLctx.getSupportedExtensions();
  var gl_exts = [];
  for (var i = 0; i < exts.length; ++i) {
   gl_exts.push(exts[i]);
   gl_exts.push("GL_" + exts[i]);
  }
  ret = stringToNewUTF8(gl_exts.join(" "));
  break;

 case 7936:
 case 7937:
 case 37445:
 case 37446:
  var s = GLctx.getParameter(name_);
  if (!s) {
   GL.recordError(1280);
   err("GL_INVALID_ENUM in glGetString: Received empty parameter for query name " + name_ + "!");
  }
  ret = stringToNewUTF8(s);
  break;

 case 7938:
  var glVersion = GLctx.getParameter(GLctx.VERSION);
  if (GL.currentContext.version >= 2) glVersion = "OpenGL ES 3.0 (" + glVersion + ")"; else {
   glVersion = "OpenGL ES 2.0 (" + glVersion + ")";
  }
  ret = stringToNewUTF8(glVersion);
  break;

 case 35724:
  var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION);
  var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
  var ver_num = glslVersion.match(ver_re);
  if (ver_num !== null) {
   if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
   glslVersion = "OpenGL ES GLSL ES " + ver_num[1] + " (" + glslVersion + ")";
  }
  ret = stringToNewUTF8(glslVersion);
  break;

 default:
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glGetString: Unknown parameter " + name_ + "!");
  return 0;
 }
 GL.stringCache[name_] = ret;
 return ret;
}

function _glGetUniformLocation(program, name) {
 GL.validateGLObjectID(GL.programs, program, "glGetUniformLocation", "program");
 name = UTF8ToString(name);
 var arrayIndex = 0;
 if (name[name.length - 1] == "]") {
  var leftBrace = name.lastIndexOf("[");
  arrayIndex = name[leftBrace + 1] != "]" ? parseInt(name.slice(leftBrace + 1)) : 0;
  name = name.slice(0, leftBrace);
 }
 var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
 if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
  return uniformInfo[1] + arrayIndex;
 } else {
  return -1;
 }
}

function _glLinkProgram(program) {
 GL.validateGLObjectID(GL.programs, program, "glLinkProgram", "program");
 GLctx.linkProgram(GL.programs[program]);
 var log = (GLctx.getProgramInfoLog(GL.programs[program]) || "").trim();
 if (log) console.error("glLinkProgram: " + log);
 GL.populateUniformTable(program);
}

function _glPixelStorei(pname, param) {
 if (pname == 3317) {
  GL.unpackAlignment = param;
 }
 GLctx.pixelStorei(pname, param);
}

function _glPolygonOffset(x0, x1) {
 GLctx["polygonOffset"](x0, x1);
}

function _glReadPixels(x, y, width, height, format, type, pixels) {
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelPackBufferBinding) {
   GLctx.readPixels(x, y, width, height, format, type, pixels);
  } else {
   GLctx.readPixels(x, y, width, height, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  }
  return;
 }
 var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
 if (!pixelData) {
  GL.recordError(1280);
  err("GL_INVALID_ENUM in glReadPixels: Unrecognized combination of type=" + type + " and format=" + format + "!");
  return;
 }
 GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

function _glRenderbufferStorage(x0, x1, x2, x3) {
 GLctx["renderbufferStorage"](x0, x1, x2, x3);
}

function _glScissor(x0, x1, x2, x3) {
 GLctx["scissor"](x0, x1, x2, x3);
}

function _glShaderSource(shader, count, string, length) {
 GL.validateGLObjectID(GL.shaders, shader, "glShaderSource", "shader");
 var source = GL.getSource(shader, count, string, length);
 if (GL.currentContext.version >= 2) {
  if (source.indexOf("#version 100") != -1) {
   source = source.replace(/#extension GL_OES_standard_derivatives : enable/g, "");
   source = source.replace(/#extension GL_EXT_shader_texture_lod : enable/g, "");
   var prelude = "";
   if (source.indexOf("gl_FragColor") != -1) {
    prelude += "out mediump vec4 GL_FragColor;\n";
    source = source.replace(/gl_FragColor/g, "GL_FragColor");
   }
   if (source.indexOf("attribute") != -1) {
    source = source.replace(/attribute/g, "in");
    source = source.replace(/varying/g, "out");
   } else {
    source = source.replace(/varying/g, "in");
   }
   source = source.replace(/textureCubeLodEXT/g, "textureCubeLod");
   source = source.replace(/texture2DLodEXT/g, "texture2DLod");
   source = source.replace(/texture2DProjLodEXT/g, "texture2DProjLod");
   source = source.replace(/texture2DGradEXT/g, "texture2DGrad");
   source = source.replace(/texture2DProjGradEXT/g, "texture2DProjGrad");
   source = source.replace(/textureCubeGradEXT/g, "textureCubeGrad");
   source = source.replace(/textureCube/g, "texture");
   source = source.replace(/texture1D/g, "texture");
   source = source.replace(/texture2D/g, "texture");
   source = source.replace(/texture3D/g, "texture");
   source = source.replace(/#version 100/g, "#version 300 es\n" + prelude);
  }
 }
 GLctx.shaderSource(GL.shaders[shader], source);
}

function _glStencilFunc(x0, x1, x2) {
 GLctx["stencilFunc"](x0, x1, x2);
}

function _glStencilFuncSeparate(x0, x1, x2, x3) {
 GLctx["stencilFuncSeparate"](x0, x1, x2, x3);
}

function _glStencilMask(x0) {
 GLctx["stencilMask"](x0);
}

function _glStencilOp(x0, x1, x2) {
 GLctx["stencilOp"](x0, x1, x2);
}

function _glStencilOpSeparate(x0, x1, x2, x3) {
 GLctx["stencilOpSeparate"](x0, x1, x2, x3);
}

function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
 if (GL.currentContext.version >= 2) {
  if (format == 6402 && internalFormat == 6402 && type == 5125) {
   internalFormat = 33190;
  }
  if (type == 36193) {
   type = 5131;
   if (format == 6408 && internalFormat == 6408) {
    internalFormat = 34842;
   }
  }
  if (internalFormat == 34041) {
   internalFormat = 35056;
  }
 }
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
  } else if (pixels != 0) {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  } else {
   GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, null);
  }
  return;
 }
 GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
}

function _glTexParameteri(x0, x1, x2) {
 GLctx["texParameteri"](x0, x1, x2);
}

function _glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
 if (GL.currentContext.version >= 2) {
  if (type == 36193) type = 5131;
 }
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  if (GLctx.currentPixelUnpackBufferBinding) {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
  } else if (pixels != 0) {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, __heapObjectForWebGLType(type), pixels >> (__heapAccessShiftForWebGLType[type] | 0));
  } else {
   GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, null);
  }
  return;
 }
 var pixelData = null;
 if (pixels) pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
 GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
}

function _glUniform1i(location, v0) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform1i", "location");
 GLctx.uniform1i(GL.uniforms[location], v0);
}

function _glUniform4fv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4fv", "location");
 assert((value & 3) == 0, "Pointer to float data passed to glUniform4fv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4fv(GL.uniforms[location], HEAPF32, value >> 2, count * 4);
  return;
 }
 if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
  var view = GL.miniTempBufferViews[4 * count - 1];
  for (var i = 0; i < 4 * count; i += 4) {
   view[i] = HEAPF32[value + 4 * i >> 2];
   view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
   view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
   view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
  }
 } else {
  var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2);
 }
 GLctx.uniform4fv(GL.uniforms[location], view);
}

function _glUniform4iv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4iv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform4iv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4iv(GL.uniforms[location], HEAP32, value >> 2, count * 4);
  return;
 }
 GLctx.uniform4iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 16 >> 2));
}

function _glUniform4uiv(location, count, value) {
 GL.validateGLObjectID(GL.uniforms, location, "glUniform4uiv", "location");
 assert((value & 3) == 0, "Pointer to integer data passed to glUniform4uiv must be aligned to four bytes!");
 if (GL.currentContext.supportsWebGL2EntryPoints) {
  GLctx.uniform4uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 4);
 } else {
  GLctx.uniform4uiv(GL.uniforms[location], HEAPU32.subarray(value >> 2, value + count * 16 >> 2));
 }
}

function _glUseProgram(program) {
 GL.validateGLObjectID(GL.programs, program, "glUseProgram", "program");
 GLctx.useProgram(GL.programs[program]);
}

function _glVertexAttrib4fv(index, v) {
 assert((v & 3) == 0, "Pointer to float data passed to glVertexAttrib4fv must be aligned to four bytes!");
 assert(v != 0, "Null pointer passed to glVertexAttrib4fv!");
 GLctx.vertexAttrib4f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2], HEAPF32[v + 8 >> 2], HEAPF32[v + 12 >> 2]);
}

function _glVertexAttribDivisor(index, divisor) {
 assert(GLctx["vertexAttribDivisor"], "Must have ANGLE_instanced_arrays extension or WebGL 2 to use WebGL instancing");
 GLctx["vertexAttribDivisor"](index, divisor);
}

function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
 GL.validateVertexAttribPointer(size, type, stride, ptr);
 GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

function _glViewport(x0, x1, x2, x3) {
 GLctx["viewport"](x0, x1, x2, x3);
}

var ___tm_current = 16109216;

var ___tm_timezone = (stringToUTF8("GMT", 16109264, 4), 16109264);

function _gmtime_r(time, tmPtr) {
 var date = new Date(HEAP32[time >> 2] * 1e3);
 HEAP32[tmPtr >> 2] = date.getUTCSeconds();
 HEAP32[tmPtr + 4 >> 2] = date.getUTCMinutes();
 HEAP32[tmPtr + 8 >> 2] = date.getUTCHours();
 HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
 HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
 HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
 HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
 HEAP32[tmPtr + 36 >> 2] = 0;
 HEAP32[tmPtr + 32 >> 2] = 0;
 var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
 var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;
 HEAP32[tmPtr + 28 >> 2] = yday;
 HEAP32[tmPtr + 40 >> 2] = ___tm_timezone;
 return tmPtr;
}

function _gmtime(time) {
 return _gmtime_r(time, ___tm_current);
}

function _inet_addr(ptr) {
 var addr = __inet_pton4_raw(UTF8ToString(ptr));
 if (addr === null) {
  return -1;
 }
 return addr;
}

function _llvm_bswap_i64(l, h) {
 var retl = _llvm_bswap_i32(h) >>> 0;
 var reth = _llvm_bswap_i32(l) >>> 0;
 return (setTempRet0(reth), retl) | 0;
}

function _llvm_exp2_f32(x) {
 return Math.pow(2, x);
}

function _llvm_exp2_f64(a0) {
 return _llvm_exp2_f32(a0);
}

function _llvm_trap() {
 abort("trap!");
}

function _tzset() {
 if (_tzset.called) return;
 _tzset.called = true;
 HEAP32[__get_timezone() >> 2] = new Date().getTimezoneOffset() * 60;
 var winter = new Date(2e3, 0, 1);
 var summer = new Date(2e3, 6, 1);
 HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());
 function extractZone(date) {
  var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
  return match ? match[1] : "GMT";
 }
 var winterName = extractZone(winter);
 var summerName = extractZone(summer);
 var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
 var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
 if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
  HEAP32[__get_tzname() >> 2] = winterNamePtr;
  HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr;
 } else {
  HEAP32[__get_tzname() >> 2] = summerNamePtr;
  HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr;
 }
}

function _localtime_r(time, tmPtr) {
 _tzset();
 var date = new Date(HEAP32[time >> 2] * 1e3);
 HEAP32[tmPtr >> 2] = date.getSeconds();
 HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
 HEAP32[tmPtr + 8 >> 2] = date.getHours();
 HEAP32[tmPtr + 12 >> 2] = date.getDate();
 HEAP32[tmPtr + 16 >> 2] = date.getMonth();
 HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
 HEAP32[tmPtr + 24 >> 2] = date.getDay();
 var start = new Date(date.getFullYear(), 0, 1);
 var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
 HEAP32[tmPtr + 28 >> 2] = yday;
 HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
 var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
 var winterOffset = start.getTimezoneOffset();
 var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
 HEAP32[tmPtr + 32 >> 2] = dst;
 var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
 HEAP32[tmPtr + 40 >> 2] = zonePtr;
 return tmPtr;
}

function _localtime(time) {
 return _localtime_r(time, ___tm_current);
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}

function _mktime(tmPtr) {
 _tzset();
 var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0);
 var dst = HEAP32[tmPtr + 32 >> 2];
 var guessedOffset = date.getTimezoneOffset();
 var start = new Date(date.getFullYear(), 0, 1);
 var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
 var winterOffset = start.getTimezoneOffset();
 var dstOffset = Math.min(winterOffset, summerOffset);
 if (dst < 0) {
  HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset);
 } else if (dst > 0 != (dstOffset == guessedOffset)) {
  var nonDstOffset = Math.max(winterOffset, summerOffset);
  var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
  date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
 }
 HEAP32[tmPtr + 24 >> 2] = date.getDay();
 var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
 HEAP32[tmPtr + 28 >> 2] = yday;
 return date.getTime() / 1e3 | 0;
}

function _usleep(useconds) {
 var msec = useconds / 1e3;
 if ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self["performance"] && self["performance"]["now"]) {
  var start = self["performance"]["now"]();
  while (self["performance"]["now"]() - start < msec) {}
 } else {
  var start = Date.now();
  while (Date.now() - start < msec) {}
 }
 return 0;
}

function _nanosleep(rqtp, rmtp) {
 var seconds = HEAP32[rqtp >> 2];
 var nanoseconds = HEAP32[rqtp + 4 >> 2];
 if (rmtp !== 0) {
  HEAP32[rmtp >> 2] = 0;
  HEAP32[rmtp + 4 >> 2] = 0;
 }
 return _usleep(seconds * 1e6 + nanoseconds / 1e3);
}

function _pthread_attr_destroy(attr) {
 return 0;
}

function _pthread_attr_init(attr) {
 return 0;
}

function _pthread_attr_setstacksize() {}

function _pthread_cancel() {}

function _pthread_cond_destroy() {
 return 0;
}

function _pthread_cond_init() {
 return 0;
}

function _pthread_cond_timedwait() {
 return 0;
}

function _pthread_cond_wait() {
 return 0;
}

function _pthread_create() {
 return 11;
}

function _pthread_exit(status) {
 _exit(status);
}

function _pthread_join() {}

function _pthread_mutexattr_destroy() {}

function _pthread_mutexattr_init() {}

function _pthread_mutexattr_setprotocol() {}

function _pthread_mutexattr_settype() {}

function _sched_yield() {
 return 0;
}

function _sigaction(signum, act, oldact) {
 err("Calling stub instead of sigaction()");
 return 0;
}

var __sigalrm_handler = 0;

function _signal(sig, func) {
 if (sig == 14) {
  __sigalrm_handler = func;
 } else {
  err("Calling stub instead of signal()");
 }
 return 0;
}

function _time(ptr) {
 var ret = Date.now() / 1e3 | 0;
 if (ptr) {
  HEAP32[ptr >> 2] = ret;
 }
 return ret;
}

function _utime(path, times) {
 var time;
 if (times) {
  var offset = 4;
  time = HEAP32[times + offset >> 2];
  time *= 1e3;
 } else {
  time = Date.now();
 }
 path = UTF8ToString(path);
 try {
  FS.utime(path, time, time);
  return 0;
 } catch (e) {
  FS.handleFSError(e);
  return -1;
 }
}

FS.staticInit();

Module["FS_createFolder"] = FS.createFolder;

Module["FS_createPath"] = FS.createPath;

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

Module["FS_createLazyFile"] = FS.createLazyFile;

Module["FS_createLink"] = FS.createLink;

Module["FS_createDevice"] = FS.createDevice;

Module["FS_unlink"] = FS.unlink;

if (ENVIRONMENT_IS_NODE) {
 var fs = require("fs");
 var NODEJS_PATH = require("path");
 NODEFS.staticInit();
}

Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
 err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
 Module["requestFullScreen"] = Module["requestFullscreen"];
 Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
 Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
 Browser.requestAnimationFrame(func);
};

Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
 Browser.setCanvasSize(width, height, noUpdates);
};

Module["pauseMainLoop"] = function Module_pauseMainLoop() {
 Browser.mainLoop.pause();
};

Module["resumeMainLoop"] = function Module_resumeMainLoop() {
 Browser.mainLoop.resume();
};

Module["getUserMedia"] = function Module_getUserMedia() {
 Browser.getUserMedia();
};

Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
 return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
};

if (ENVIRONMENT_IS_NODE) {
 _emscripten_get_now = function _emscripten_get_now_actual() {
  var t = process["hrtime"]();
  return t[0] * 1e3 + t[1] / 1e6;
 };
} else if (typeof dateNow !== "undefined") {
 _emscripten_get_now = dateNow;
} else if (typeof performance === "object" && performance && typeof performance["now"] === "function") {
 _emscripten_get_now = function() {
  return performance["now"]();
 };
} else {
 _emscripten_get_now = Date.now;
}

var GLctx;

GL.init();

for (var i = 0; i < 32; i++) __tempFixedLengthArray.push(new Array(i));

var ASSERTIONS = true;

function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}

function nullFunc_di(x) {
 err("Invalid function pointer called with signature 'di'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_did(x) {
 err("Invalid function pointer called with signature 'did'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_didd(x) {
 err("Invalid function pointer called with signature 'didd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_dif(x) {
 err("Invalid function pointer called with signature 'dif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_dii(x) {
 err("Invalid function pointer called with signature 'dii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_diid(x) {
 err("Invalid function pointer called with signature 'diid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_diii(x) {
 err("Invalid function pointer called with signature 'diii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_f(x) {
 err("Invalid function pointer called with signature 'f'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fi(x) {
 err("Invalid function pointer called with signature 'fi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fif(x) {
 err("Invalid function pointer called with signature 'fif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiff(x) {
 err("Invalid function pointer called with signature 'fiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiffi(x) {
 err("Invalid function pointer called with signature 'fiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fifi(x) {
 err("Invalid function pointer called with signature 'fifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fifii(x) {
 err("Invalid function pointer called with signature 'fifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fifiii(x) {
 err("Invalid function pointer called with signature 'fifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fii(x) {
 err("Invalid function pointer called with signature 'fii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiif(x) {
 err("Invalid function pointer called with signature 'fiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiifi(x) {
 err("Invalid function pointer called with signature 'fiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiifiii(x) {
 err("Invalid function pointer called with signature 'fiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiii(x) {
 err("Invalid function pointer called with signature 'fiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiif(x) {
 err("Invalid function pointer called with signature 'fiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiii(x) {
 err("Invalid function pointer called with signature 'fiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiif(x) {
 err("Invalid function pointer called with signature 'fiiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiifi(x) {
 err("Invalid function pointer called with signature 'fiiiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiifiifif(x) {
 err("Invalid function pointer called with signature 'fiiiiiifiifif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiifiiiif(x) {
 err("Invalid function pointer called with signature 'fiiiiiifiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiii(x) {
 err("Invalid function pointer called with signature 'fiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiiiiiii(x) {
 err("Invalid function pointer called with signature 'fiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fiiijiijiijii(x) {
 err("Invalid function pointer called with signature 'fiiijiijiijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_fij(x) {
 err("Invalid function pointer called with signature 'fij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_i(x) {
 err("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_if(x) {
 err("Invalid function pointer called with signature 'if'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_ii(x) {
 err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iid(x) {
 err("Invalid function pointer called with signature 'iid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidf(x) {
 err("Invalid function pointer called with signature 'iidf'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidfi(x) {
 err("Invalid function pointer called with signature 'iidfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidi(x) {
 err("Invalid function pointer called with signature 'iidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidii(x) {
 err("Invalid function pointer called with signature 'iidii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidiii(x) {
 err("Invalid function pointer called with signature 'iidiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iidiiii(x) {
 err("Invalid function pointer called with signature 'iidiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iif(x) {
 err("Invalid function pointer called with signature 'iif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiff(x) {
 err("Invalid function pointer called with signature 'iiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifff(x) {
 err("Invalid function pointer called with signature 'iifff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifffffii(x) {
 err("Invalid function pointer called with signature 'iifffffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiffffi(x) {
 err("Invalid function pointer called with signature 'iiffffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiffi(x) {
 err("Invalid function pointer called with signature 'iiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiffif(x) {
 err("Invalid function pointer called with signature 'iiffif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiffii(x) {
 err("Invalid function pointer called with signature 'iiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiffiiiiii(x) {
 err("Invalid function pointer called with signature 'iiffiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifi(x) {
 err("Invalid function pointer called with signature 'iifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iififi(x) {
 err("Invalid function pointer called with signature 'iififi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifii(x) {
 err("Invalid function pointer called with signature 'iifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiii(x) {
 err("Invalid function pointer called with signature 'iifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiiif(x) {
 err("Invalid function pointer called with signature 'iifiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiiifiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iifiiifiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiiii(x) {
 err("Invalid function pointer called with signature 'iifiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iifiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iifiiiiij(x) {
 err("Invalid function pointer called with signature 'iifiiiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiddii(x) {
 err("Invalid function pointer called with signature 'iiiddii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiidi(x) {
 err("Invalid function pointer called with signature 'iiidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiif(x) {
 err("Invalid function pointer called with signature 'iiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiff(x) {
 err("Invalid function pointer called with signature 'iiiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiffffiifii(x) {
 err("Invalid function pointer called with signature 'iiiffffiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiffi(x) {
 err("Invalid function pointer called with signature 'iiiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiffii(x) {
 err("Invalid function pointer called with signature 'iiiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiifi(x) {
 err("Invalid function pointer called with signature 'iiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiifii(x) {
 err("Invalid function pointer called with signature 'iiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiifiifi(x) {
 err("Invalid function pointer called with signature 'iiifiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiifiii(x) {
 err("Invalid function pointer called with signature 'iiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiifiiiif(x) {
 err("Invalid function pointer called with signature 'iiifiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiddii(x) {
 err("Invalid function pointer called with signature 'iiiiddii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiidi(x) {
 err("Invalid function pointer called with signature 'iiiidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiidii(x) {
 err("Invalid function pointer called with signature 'iiiidii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiif(x) {
 err("Invalid function pointer called with signature 'iiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiffffi(x) {
 err("Invalid function pointer called with signature 'iiiiffffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiffi(x) {
 err("Invalid function pointer called with signature 'iiiiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiffii(x) {
 err("Invalid function pointer called with signature 'iiiiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiffiii(x) {
 err("Invalid function pointer called with signature 'iiiiffiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiffiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiffiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiifi(x) {
 err("Invalid function pointer called with signature 'iiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiifii(x) {
 err("Invalid function pointer called with signature 'iiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiifiii(x) {
 err("Invalid function pointer called with signature 'iiiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiifiiii(x) {
 err("Invalid function pointer called with signature 'iiiifiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiifiiiii(x) {
 err("Invalid function pointer called with signature 'iiiifiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiii(x) {
 err("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiif(x) {
 err("Invalid function pointer called with signature 'iiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiffii(x) {
 err("Invalid function pointer called with signature 'iiiiiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiifi(x) {
 err("Invalid function pointer called with signature 'iiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiifii(x) {
 err("Invalid function pointer called with signature 'iiiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiifiii(x) {
 err("Invalid function pointer called with signature 'iiiiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiifiiiif(x) {
 err("Invalid function pointer called with signature 'iiiiifiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiifiiiiif(x) {
 err("Invalid function pointer called with signature 'iiiiifiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiidii(x) {
 err("Invalid function pointer called with signature 'iiiiiidii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiif(x) {
 err("Invalid function pointer called with signature 'iiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiffii(x) {
 err("Invalid function pointer called with signature 'iiiiiiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiifi(x) {
 err("Invalid function pointer called with signature 'iiiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiifii(x) {
 err("Invalid function pointer called with signature 'iiiiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiifiif(x) {
 err("Invalid function pointer called with signature 'iiiiiifiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiifiii(x) {
 err("Invalid function pointer called with signature 'iiiiiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiifi(x) {
 err("Invalid function pointer called with signature 'iiiiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiifii(x) {
 err("Invalid function pointer called with signature 'iiiiiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiifiif(x) {
 err("Invalid function pointer called with signature 'iiiiiiifiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiif(x) {
 err("Invalid function pointer called with signature 'iiiiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'iiiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiiiiiji(x) {
 err("Invalid function pointer called with signature 'iiiiiiiiiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiiiij(x) {
 err("Invalid function pointer called with signature 'iiiiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiij(x) {
 err("Invalid function pointer called with signature 'iiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiij(x) {
 err("Invalid function pointer called with signature 'iiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiiji(x) {
 err("Invalid function pointer called with signature 'iiiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiijj(x) {
 err("Invalid function pointer called with signature 'iiijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iij(x) {
 err("Invalid function pointer called with signature 'iij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iiji(x) {
 err("Invalid function pointer called with signature 'iiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijii(x) {
 err("Invalid function pointer called with signature 'iijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijiii(x) {
 err("Invalid function pointer called with signature 'iijiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijiiii(x) {
 err("Invalid function pointer called with signature 'iijiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijj(x) {
 err("Invalid function pointer called with signature 'iijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijji(x) {
 err("Invalid function pointer called with signature 'iijji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijjiii(x) {
 err("Invalid function pointer called with signature 'iijjiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_iijjji(x) {
 err("Invalid function pointer called with signature 'iijjji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_ji(x) {
 err("Invalid function pointer called with signature 'ji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jii(x) {
 err("Invalid function pointer called with signature 'jii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiii(x) {
 err("Invalid function pointer called with signature 'jiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiiii(x) {
 err("Invalid function pointer called with signature 'jiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiiiiii(x) {
 err("Invalid function pointer called with signature 'jiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiiiiiiii(x) {
 err("Invalid function pointer called with signature 'jiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiij(x) {
 err("Invalid function pointer called with signature 'jiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jij(x) {
 err("Invalid function pointer called with signature 'jij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_jiji(x) {
 err("Invalid function pointer called with signature 'jiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vf(x) {
 err("Invalid function pointer called with signature 'vf'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vff(x) {
 err("Invalid function pointer called with signature 'vff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vffff(x) {
 err("Invalid function pointer called with signature 'vffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vfi(x) {
 err("Invalid function pointer called with signature 'vfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vid(x) {
 err("Invalid function pointer called with signature 'vid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vidi(x) {
 err("Invalid function pointer called with signature 'vidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vidii(x) {
 err("Invalid function pointer called with signature 'vidii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vidiiii(x) {
 err("Invalid function pointer called with signature 'vidiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vidiiiii(x) {
 err("Invalid function pointer called with signature 'vidiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vif(x) {
 err("Invalid function pointer called with signature 'vif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viff(x) {
 err("Invalid function pointer called with signature 'viff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifff(x) {
 err("Invalid function pointer called with signature 'vifff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffff(x) {
 err("Invalid function pointer called with signature 'viffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffffff(x) {
 err("Invalid function pointer called with signature 'viffffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffffffffffffiiii(x) {
 err("Invalid function pointer called with signature 'viffffffffffffiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffffi(x) {
 err("Invalid function pointer called with signature 'viffffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifffiii(x) {
 err("Invalid function pointer called with signature 'vifffiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffi(x) {
 err("Invalid function pointer called with signature 'viffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffif(x) {
 err("Invalid function pointer called with signature 'viffif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffiff(x) {
 err("Invalid function pointer called with signature 'viffiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffii(x) {
 err("Invalid function pointer called with signature 'viffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffiifiiiii(x) {
 err("Invalid function pointer called with signature 'viffiifiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viffiiiii(x) {
 err("Invalid function pointer called with signature 'viffiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifi(x) {
 err("Invalid function pointer called with signature 'vifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vififfi(x) {
 err("Invalid function pointer called with signature 'vififfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifii(x) {
 err("Invalid function pointer called with signature 'vifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiifi(x) {
 err("Invalid function pointer called with signature 'vifiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiifiifiiiii(x) {
 err("Invalid function pointer called with signature 'vifiifiifiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiii(x) {
 err("Invalid function pointer called with signature 'vifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiiifiiiiiiii(x) {
 err("Invalid function pointer called with signature 'vifiiifiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiiii(x) {
 err("Invalid function pointer called with signature 'vifiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiiiiii(x) {
 err("Invalid function pointer called with signature 'vifiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiiiiiii(x) {
 err("Invalid function pointer called with signature 'vifiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vifiiiiiiii(x) {
 err("Invalid function pointer called with signature 'vifiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viid(x) {
 err("Invalid function pointer called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viidddd(x) {
 err("Invalid function pointer called with signature 'viidddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viidf(x) {
 err("Invalid function pointer called with signature 'viidf'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viif(x) {
 err("Invalid function pointer called with signature 'viif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiff(x) {
 err("Invalid function pointer called with signature 'viiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifff(x) {
 err("Invalid function pointer called with signature 'viifff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffffffffiiii(x) {
 err("Invalid function pointer called with signature 'viiffffffffiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffffffii(x) {
 err("Invalid function pointer called with signature 'viiffffffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffffiiii(x) {
 err("Invalid function pointer called with signature 'viiffffiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifffi(x) {
 err("Invalid function pointer called with signature 'viifffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffi(x) {
 err("Invalid function pointer called with signature 'viiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffifi(x) {
 err("Invalid function pointer called with signature 'viiffifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffii(x) {
 err("Invalid function pointer called with signature 'viiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiffiiiffffi(x) {
 err("Invalid function pointer called with signature 'viiffiiiffffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifi(x) {
 err("Invalid function pointer called with signature 'viifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viififi(x) {
 err("Invalid function pointer called with signature 'viififi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifii(x) {
 err("Invalid function pointer called with signature 'viifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiiff(x) {
 err("Invalid function pointer called with signature 'viifiiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiifi(x) {
 err("Invalid function pointer called with signature 'viifiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiii(x) {
 err("Invalid function pointer called with signature 'viifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiiii(x) {
 err("Invalid function pointer called with signature 'viifiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiiiii(x) {
 err("Invalid function pointer called with signature 'viifiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viifiiiiiii(x) {
 err("Invalid function pointer called with signature 'viifiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiidddd(x) {
 err("Invalid function pointer called with signature 'viiidddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiidi(x) {
 err("Invalid function pointer called with signature 'viiidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiif(x) {
 err("Invalid function pointer called with signature 'viiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiff(x) {
 err("Invalid function pointer called with signature 'viiiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifi(x) {
 err("Invalid function pointer called with signature 'viiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifif(x) {
 err("Invalid function pointer called with signature 'viiifif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifii(x) {
 err("Invalid function pointer called with signature 'viiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifiif(x) {
 err("Invalid function pointer called with signature 'viiifiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifiiffii(x) {
 err("Invalid function pointer called with signature 'viiifiiffii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifiii(x) {
 err("Invalid function pointer called with signature 'viiifiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiifiiiii(x) {
 err("Invalid function pointer called with signature 'viiifiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiid(x) {
 err("Invalid function pointer called with signature 'viiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiif(x) {
 err("Invalid function pointer called with signature 'viiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiffi(x) {
 err("Invalid function pointer called with signature 'viiiiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiifi(x) {
 err("Invalid function pointer called with signature 'viiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiifii(x) {
 err("Invalid function pointer called with signature 'viiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiifiif(x) {
 err("Invalid function pointer called with signature 'viiiifiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiifiiiiif(x) {
 err("Invalid function pointer called with signature 'viiiifiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiif(x) {
 err("Invalid function pointer called with signature 'viiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiff(x) {
 err("Invalid function pointer called with signature 'viiiiiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiffi(x) {
 err("Invalid function pointer called with signature 'viiiiiffi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiifi(x) {
 err("Invalid function pointer called with signature 'viiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiifii(x) {
 err("Invalid function pointer called with signature 'viiiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiifiiiif(x) {
 err("Invalid function pointer called with signature 'viiiiifiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiid(x) {
 err("Invalid function pointer called with signature 'viiiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiifi(x) {
 err("Invalid function pointer called with signature 'viiiiiifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiif(x) {
 err("Invalid function pointer called with signature 'viiiiiiif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiiiifii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiiiifii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiiiiiiiiiiii(x) {
 err("Invalid function pointer called with signature 'viiiiiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiiij(x) {
 err("Invalid function pointer called with signature 'viiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiij(x) {
 err("Invalid function pointer called with signature 'viiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiijji(x) {
 err("Invalid function pointer called with signature 'viiijji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viij(x) {
 err("Invalid function pointer called with signature 'viij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viiji(x) {
 err("Invalid function pointer called with signature 'viiji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viijii(x) {
 err("Invalid function pointer called with signature 'viijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viijijj(x) {
 err("Invalid function pointer called with signature 'viijijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viijj(x) {
 err("Invalid function pointer called with signature 'viijj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viijjjii(x) {
 err("Invalid function pointer called with signature 'viijjjii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vij(x) {
 err("Invalid function pointer called with signature 'vij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_viji(x) {
 err("Invalid function pointer called with signature 'viji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vijii(x) {
 err("Invalid function pointer called with signature 'vijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vijji(x) {
 err("Invalid function pointer called with signature 'vijji'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vijjjii(x) {
 err("Invalid function pointer called with signature 'vijjjii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vj(x) {
 err("Invalid function pointer called with signature 'vj'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function nullFunc_vjfi(x) {
 err("Invalid function pointer called with signature 'vjfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("Build with ASSERTIONS=2 for more info.");
 abort(x);
}

function invoke_ii(index, a1) {
 var sp = stackSave();
 try {
  return dynCall_ii(index, a1);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_iii(index, a1, a2) {
 var sp = stackSave();
 try {
  return dynCall_iii(index, a1, a2);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_iiii(index, a1, a2, a3) {
 var sp = stackSave();
 try {
  return dynCall_iiii(index, a1, a2, a3);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_iiiii(index, a1, a2, a3, a4) {
 var sp = stackSave();
 try {
  return dynCall_iiiii(index, a1, a2, a3, a4);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
 var sp = stackSave();
 try {
  return dynCall_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_v(index) {
 var sp = stackSave();
 try {
  dynCall_v(index);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_vi(index, a1) {
 var sp = stackSave();
 try {
  dynCall_vi(index, a1);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_vii(index, a1, a2) {
 var sp = stackSave();
 try {
  dynCall_vii(index, a1, a2);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_viii(index, a1, a2, a3) {
 var sp = stackSave();
 try {
  dynCall_viii(index, a1, a2, a3);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_viiii(index, a1, a2, a3, a4) {
 var sp = stackSave();
 try {
  dynCall_viiii(index, a1, a2, a3, a4);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
 var sp = stackSave();
 try {
  dynCall_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
 } catch (e) {
  stackRestore(sp);
  if (e !== e + 0 && e !== "longjmp") throw e;
  _setThrew(1, 0);
 }
}

var asmGlobalArg = {};

var asmLibraryArg = {
 "abort": abort,
 "setTempRet0": setTempRet0,
 "getTempRet0": getTempRet0,
 "abortStackOverflow": abortStackOverflow,
 "nullFunc_di": nullFunc_di,
 "nullFunc_did": nullFunc_did,
 "nullFunc_didd": nullFunc_didd,
 "nullFunc_dif": nullFunc_dif,
 "nullFunc_dii": nullFunc_dii,
 "nullFunc_diid": nullFunc_diid,
 "nullFunc_diii": nullFunc_diii,
 "nullFunc_f": nullFunc_f,
 "nullFunc_fi": nullFunc_fi,
 "nullFunc_fif": nullFunc_fif,
 "nullFunc_fiff": nullFunc_fiff,
 "nullFunc_fiffi": nullFunc_fiffi,
 "nullFunc_fifi": nullFunc_fifi,
 "nullFunc_fifii": nullFunc_fifii,
 "nullFunc_fifiii": nullFunc_fifiii,
 "nullFunc_fii": nullFunc_fii,
 "nullFunc_fiif": nullFunc_fiif,
 "nullFunc_fiifi": nullFunc_fiifi,
 "nullFunc_fiifiii": nullFunc_fiifiii,
 "nullFunc_fiii": nullFunc_fiii,
 "nullFunc_fiiif": nullFunc_fiiif,
 "nullFunc_fiiii": nullFunc_fiiii,
 "nullFunc_fiiiiiif": nullFunc_fiiiiiif,
 "nullFunc_fiiiiiifi": nullFunc_fiiiiiifi,
 "nullFunc_fiiiiiifiifif": nullFunc_fiiiiiifiifif,
 "nullFunc_fiiiiiifiiiif": nullFunc_fiiiiiifiiiif,
 "nullFunc_fiiiiiii": nullFunc_fiiiiiii,
 "nullFunc_fiiiiiiii": nullFunc_fiiiiiiii,
 "nullFunc_fiiijiijiijii": nullFunc_fiiijiijiijii,
 "nullFunc_fij": nullFunc_fij,
 "nullFunc_i": nullFunc_i,
 "nullFunc_if": nullFunc_if,
 "nullFunc_ii": nullFunc_ii,
 "nullFunc_iid": nullFunc_iid,
 "nullFunc_iidf": nullFunc_iidf,
 "nullFunc_iidfi": nullFunc_iidfi,
 "nullFunc_iidi": nullFunc_iidi,
 "nullFunc_iidii": nullFunc_iidii,
 "nullFunc_iidiii": nullFunc_iidiii,
 "nullFunc_iidiiii": nullFunc_iidiiii,
 "nullFunc_iif": nullFunc_iif,
 "nullFunc_iiff": nullFunc_iiff,
 "nullFunc_iifff": nullFunc_iifff,
 "nullFunc_iifffffii": nullFunc_iifffffii,
 "nullFunc_iiffffi": nullFunc_iiffffi,
 "nullFunc_iiffi": nullFunc_iiffi,
 "nullFunc_iiffif": nullFunc_iiffif,
 "nullFunc_iiffii": nullFunc_iiffii,
 "nullFunc_iiffiiiiii": nullFunc_iiffiiiiii,
 "nullFunc_iifi": nullFunc_iifi,
 "nullFunc_iififi": nullFunc_iififi,
 "nullFunc_iifii": nullFunc_iifii,
 "nullFunc_iifiii": nullFunc_iifiii,
 "nullFunc_iifiiif": nullFunc_iifiiif,
 "nullFunc_iifiiifiiiiiiii": nullFunc_iifiiifiiiiiiii,
 "nullFunc_iifiiii": nullFunc_iifiiii,
 "nullFunc_iifiiiiiiii": nullFunc_iifiiiiiiii,
 "nullFunc_iifiiiiij": nullFunc_iifiiiiij,
 "nullFunc_iii": nullFunc_iii,
 "nullFunc_iiiddii": nullFunc_iiiddii,
 "nullFunc_iiidi": nullFunc_iiidi,
 "nullFunc_iiif": nullFunc_iiif,
 "nullFunc_iiiff": nullFunc_iiiff,
 "nullFunc_iiiffffiifii": nullFunc_iiiffffiifii,
 "nullFunc_iiiffi": nullFunc_iiiffi,
 "nullFunc_iiiffii": nullFunc_iiiffii,
 "nullFunc_iiifi": nullFunc_iiifi,
 "nullFunc_iiifii": nullFunc_iiifii,
 "nullFunc_iiifiifi": nullFunc_iiifiifi,
 "nullFunc_iiifiii": nullFunc_iiifiii,
 "nullFunc_iiifiiiif": nullFunc_iiifiiiif,
 "nullFunc_iiii": nullFunc_iiii,
 "nullFunc_iiiiddii": nullFunc_iiiiddii,
 "nullFunc_iiiidi": nullFunc_iiiidi,
 "nullFunc_iiiidii": nullFunc_iiiidii,
 "nullFunc_iiiif": nullFunc_iiiif,
 "nullFunc_iiiiffffi": nullFunc_iiiiffffi,
 "nullFunc_iiiiffi": nullFunc_iiiiffi,
 "nullFunc_iiiiffii": nullFunc_iiiiffii,
 "nullFunc_iiiiffiii": nullFunc_iiiiffiii,
 "nullFunc_iiiiffiiiiiii": nullFunc_iiiiffiiiiiii,
 "nullFunc_iiiifi": nullFunc_iiiifi,
 "nullFunc_iiiifii": nullFunc_iiiifii,
 "nullFunc_iiiifiii": nullFunc_iiiifiii,
 "nullFunc_iiiifiiii": nullFunc_iiiifiiii,
 "nullFunc_iiiifiiiii": nullFunc_iiiifiiiii,
 "nullFunc_iiiii": nullFunc_iiiii,
 "nullFunc_iiiiif": nullFunc_iiiiif,
 "nullFunc_iiiiiffii": nullFunc_iiiiiffii,
 "nullFunc_iiiiifi": nullFunc_iiiiifi,
 "nullFunc_iiiiifii": nullFunc_iiiiifii,
 "nullFunc_iiiiifiii": nullFunc_iiiiifiii,
 "nullFunc_iiiiifiiiif": nullFunc_iiiiifiiiif,
 "nullFunc_iiiiifiiiiif": nullFunc_iiiiifiiiiif,
 "nullFunc_iiiiii": nullFunc_iiiiii,
 "nullFunc_iiiiiidii": nullFunc_iiiiiidii,
 "nullFunc_iiiiiif": nullFunc_iiiiiif,
 "nullFunc_iiiiiiffii": nullFunc_iiiiiiffii,
 "nullFunc_iiiiiifi": nullFunc_iiiiiifi,
 "nullFunc_iiiiiifii": nullFunc_iiiiiifii,
 "nullFunc_iiiiiifiif": nullFunc_iiiiiifiif,
 "nullFunc_iiiiiifiii": nullFunc_iiiiiifiii,
 "nullFunc_iiiiiii": nullFunc_iiiiiii,
 "nullFunc_iiiiiiifi": nullFunc_iiiiiiifi,
 "nullFunc_iiiiiiifii": nullFunc_iiiiiiifii,
 "nullFunc_iiiiiiifiif": nullFunc_iiiiiiifiif,
 "nullFunc_iiiiiiii": nullFunc_iiiiiiii,
 "nullFunc_iiiiiiiif": nullFunc_iiiiiiiif,
 "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii,
 "nullFunc_iiiiiiiiii": nullFunc_iiiiiiiiii,
 "nullFunc_iiiiiiiiiii": nullFunc_iiiiiiiiiii,
 "nullFunc_iiiiiiiiiiii": nullFunc_iiiiiiiiiiii,
 "nullFunc_iiiiiiiiiiiii": nullFunc_iiiiiiiiiiiii,
 "nullFunc_iiiiiiiiiji": nullFunc_iiiiiiiiiji,
 "nullFunc_iiiiiij": nullFunc_iiiiiij,
 "nullFunc_iiiij": nullFunc_iiiij,
 "nullFunc_iiij": nullFunc_iiij,
 "nullFunc_iiiji": nullFunc_iiiji,
 "nullFunc_iiijj": nullFunc_iiijj,
 "nullFunc_iij": nullFunc_iij,
 "nullFunc_iiji": nullFunc_iiji,
 "nullFunc_iijii": nullFunc_iijii,
 "nullFunc_iijiii": nullFunc_iijiii,
 "nullFunc_iijiiii": nullFunc_iijiiii,
 "nullFunc_iijj": nullFunc_iijj,
 "nullFunc_iijji": nullFunc_iijji,
 "nullFunc_iijjiii": nullFunc_iijjiii,
 "nullFunc_iijjji": nullFunc_iijjji,
 "nullFunc_ji": nullFunc_ji,
 "nullFunc_jii": nullFunc_jii,
 "nullFunc_jiii": nullFunc_jiii,
 "nullFunc_jiiii": nullFunc_jiiii,
 "nullFunc_jiiiiii": nullFunc_jiiiiii,
 "nullFunc_jiiiiiiii": nullFunc_jiiiiiiii,
 "nullFunc_jiij": nullFunc_jiij,
 "nullFunc_jij": nullFunc_jij,
 "nullFunc_jiji": nullFunc_jiji,
 "nullFunc_v": nullFunc_v,
 "nullFunc_vf": nullFunc_vf,
 "nullFunc_vff": nullFunc_vff,
 "nullFunc_vffff": nullFunc_vffff,
 "nullFunc_vfi": nullFunc_vfi,
 "nullFunc_vi": nullFunc_vi,
 "nullFunc_vid": nullFunc_vid,
 "nullFunc_vidi": nullFunc_vidi,
 "nullFunc_vidii": nullFunc_vidii,
 "nullFunc_vidiiii": nullFunc_vidiiii,
 "nullFunc_vidiiiii": nullFunc_vidiiiii,
 "nullFunc_vif": nullFunc_vif,
 "nullFunc_viff": nullFunc_viff,
 "nullFunc_vifff": nullFunc_vifff,
 "nullFunc_viffff": nullFunc_viffff,
 "nullFunc_viffffff": nullFunc_viffffff,
 "nullFunc_viffffffffffffiiii": nullFunc_viffffffffffffiiii,
 "nullFunc_viffffi": nullFunc_viffffi,
 "nullFunc_vifffiii": nullFunc_vifffiii,
 "nullFunc_viffi": nullFunc_viffi,
 "nullFunc_viffif": nullFunc_viffif,
 "nullFunc_viffiff": nullFunc_viffiff,
 "nullFunc_viffii": nullFunc_viffii,
 "nullFunc_viffiifiiiii": nullFunc_viffiifiiiii,
 "nullFunc_viffiiiii": nullFunc_viffiiiii,
 "nullFunc_vifi": nullFunc_vifi,
 "nullFunc_vififfi": nullFunc_vififfi,
 "nullFunc_vifii": nullFunc_vifii,
 "nullFunc_vifiifi": nullFunc_vifiifi,
 "nullFunc_vifiifiifiiiii": nullFunc_vifiifiifiiiii,
 "nullFunc_vifiii": nullFunc_vifiii,
 "nullFunc_vifiiifiiiiiiii": nullFunc_vifiiifiiiiiiii,
 "nullFunc_vifiiii": nullFunc_vifiiii,
 "nullFunc_vifiiiiii": nullFunc_vifiiiiii,
 "nullFunc_vifiiiiiii": nullFunc_vifiiiiiii,
 "nullFunc_vifiiiiiiii": nullFunc_vifiiiiiiii,
 "nullFunc_vii": nullFunc_vii,
 "nullFunc_viid": nullFunc_viid,
 "nullFunc_viidddd": nullFunc_viidddd,
 "nullFunc_viidf": nullFunc_viidf,
 "nullFunc_viif": nullFunc_viif,
 "nullFunc_viiff": nullFunc_viiff,
 "nullFunc_viifff": nullFunc_viifff,
 "nullFunc_viiffffffffiiii": nullFunc_viiffffffffiiii,
 "nullFunc_viiffffffii": nullFunc_viiffffffii,
 "nullFunc_viiffffiiii": nullFunc_viiffffiiii,
 "nullFunc_viifffi": nullFunc_viifffi,
 "nullFunc_viiffi": nullFunc_viiffi,
 "nullFunc_viiffifi": nullFunc_viiffifi,
 "nullFunc_viiffii": nullFunc_viiffii,
 "nullFunc_viiffiiiffffi": nullFunc_viiffiiiffffi,
 "nullFunc_viifi": nullFunc_viifi,
 "nullFunc_viififi": nullFunc_viififi,
 "nullFunc_viifii": nullFunc_viifii,
 "nullFunc_viifiiff": nullFunc_viifiiff,
 "nullFunc_viifiifi": nullFunc_viifiifi,
 "nullFunc_viifiii": nullFunc_viifiii,
 "nullFunc_viifiiii": nullFunc_viifiiii,
 "nullFunc_viifiiiii": nullFunc_viifiiiii,
 "nullFunc_viifiiiiiii": nullFunc_viifiiiiiii,
 "nullFunc_viii": nullFunc_viii,
 "nullFunc_viiidddd": nullFunc_viiidddd,
 "nullFunc_viiidi": nullFunc_viiidi,
 "nullFunc_viiif": nullFunc_viiif,
 "nullFunc_viiiff": nullFunc_viiiff,
 "nullFunc_viiifi": nullFunc_viiifi,
 "nullFunc_viiifif": nullFunc_viiifif,
 "nullFunc_viiifii": nullFunc_viiifii,
 "nullFunc_viiifiif": nullFunc_viiifiif,
 "nullFunc_viiifiiffii": nullFunc_viiifiiffii,
 "nullFunc_viiifiii": nullFunc_viiifiii,
 "nullFunc_viiifiiiii": nullFunc_viiifiiiii,
 "nullFunc_viiii": nullFunc_viiii,
 "nullFunc_viiiid": nullFunc_viiiid,
 "nullFunc_viiiif": nullFunc_viiiif,
 "nullFunc_viiiiffi": nullFunc_viiiiffi,
 "nullFunc_viiiifi": nullFunc_viiiifi,
 "nullFunc_viiiifii": nullFunc_viiiifii,
 "nullFunc_viiiifiif": nullFunc_viiiifiif,
 "nullFunc_viiiifiiiiif": nullFunc_viiiifiiiiif,
 "nullFunc_viiiii": nullFunc_viiiii,
 "nullFunc_viiiiif": nullFunc_viiiiif,
 "nullFunc_viiiiiff": nullFunc_viiiiiff,
 "nullFunc_viiiiiffi": nullFunc_viiiiiffi,
 "nullFunc_viiiiifi": nullFunc_viiiiifi,
 "nullFunc_viiiiifii": nullFunc_viiiiifii,
 "nullFunc_viiiiifiiiif": nullFunc_viiiiifiiiif,
 "nullFunc_viiiiii": nullFunc_viiiiii,
 "nullFunc_viiiiiid": nullFunc_viiiiiid,
 "nullFunc_viiiiiifi": nullFunc_viiiiiifi,
 "nullFunc_viiiiiii": nullFunc_viiiiiii,
 "nullFunc_viiiiiiif": nullFunc_viiiiiiif,
 "nullFunc_viiiiiiii": nullFunc_viiiiiiii,
 "nullFunc_viiiiiiiii": nullFunc_viiiiiiiii,
 "nullFunc_viiiiiiiiii": nullFunc_viiiiiiiiii,
 "nullFunc_viiiiiiiiiii": nullFunc_viiiiiiiiiii,
 "nullFunc_viiiiiiiiiiifii": nullFunc_viiiiiiiiiiifii,
 "nullFunc_viiiiiiiiiiii": nullFunc_viiiiiiiiiiii,
 "nullFunc_viiiiiiiiiiiii": nullFunc_viiiiiiiiiiiii,
 "nullFunc_viiiiiiiiiiiiii": nullFunc_viiiiiiiiiiiiii,
 "nullFunc_viiiij": nullFunc_viiiij,
 "nullFunc_viiij": nullFunc_viiij,
 "nullFunc_viiijji": nullFunc_viiijji,
 "nullFunc_viij": nullFunc_viij,
 "nullFunc_viiji": nullFunc_viiji,
 "nullFunc_viijii": nullFunc_viijii,
 "nullFunc_viijijj": nullFunc_viijijj,
 "nullFunc_viijj": nullFunc_viijj,
 "nullFunc_viijjjii": nullFunc_viijjjii,
 "nullFunc_vij": nullFunc_vij,
 "nullFunc_viji": nullFunc_viji,
 "nullFunc_vijii": nullFunc_vijii,
 "nullFunc_vijji": nullFunc_vijji,
 "nullFunc_vijjjii": nullFunc_vijjjii,
 "nullFunc_vj": nullFunc_vj,
 "nullFunc_vjfi": nullFunc_vjfi,
 "invoke_ii": invoke_ii,
 "invoke_iii": invoke_iii,
 "invoke_iiii": invoke_iiii,
 "invoke_iiiii": invoke_iiiii,
 "invoke_iiiiiiii": invoke_iiiiiiii,
 "invoke_v": invoke_v,
 "invoke_vi": invoke_vi,
 "invoke_vii": invoke_vii,
 "invoke_viii": invoke_viii,
 "invoke_viiii": invoke_viiii,
 "invoke_viiiiiiiii": invoke_viiiiiiiii,
 "_JSEvents_requestFullscreen": _JSEvents_requestFullscreen,
 "_JSEvents_resizeCanvasForFullscreen": _JSEvents_resizeCanvasForFullscreen,
 "_UE_BrowserWebGLVersion": _UE_BrowserWebGLVersion,
 "_UE_DeleteSavedGame": _UE_DeleteSavedGame,
 "_UE_DoesSaveGameExist": _UE_DoesSaveGameExist,
 "_UE_EngineRegisterCanvasResizeListener": _UE_EngineRegisterCanvasResizeListener,
 "_UE_GSystemResolution": _UE_GSystemResolution,
 "_UE_GetCurrentCultureName": _UE_GetCurrentCultureName,
 "_UE_LoadGame": _UE_LoadGame,
 "_UE_MakeHTTPDataRequest": _UE_MakeHTTPDataRequest,
 "_UE_MessageBox": _UE_MessageBox,
 "_UE_SaveGame": _UE_SaveGame,
 "_UE_SendAndRecievePayLoad": _UE_SendAndRecievePayLoad,
 "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv,
 "___buildEnvironment": ___buildEnvironment,
 "___cxa_allocate_exception": ___cxa_allocate_exception,
 "___cxa_begin_catch": ___cxa_begin_catch,
 "___cxa_find_matching_catch": ___cxa_find_matching_catch,
 "___cxa_free_exception": ___cxa_free_exception,
 "___cxa_pure_virtual": ___cxa_pure_virtual,
 "___cxa_throw": ___cxa_throw,
 "___gxx_personality_v0": ___gxx_personality_v0,
 "___lock": ___lock,
 "___map_file": ___map_file,
 "___resumeException": ___resumeException,
 "___setErrNo": ___setErrNo,
 "___syscall10": ___syscall10,
 "___syscall102": ___syscall102,
 "___syscall118": ___syscall118,
 "___syscall122": ___syscall122,
 "___syscall140": ___syscall140,
 "___syscall142": ___syscall142,
 "___syscall145": ___syscall145,
 "___syscall146": ___syscall146,
 "___syscall148": ___syscall148,
 "___syscall15": ___syscall15,
 "___syscall192": ___syscall192,
 "___syscall194": ___syscall194,
 "___syscall195": ___syscall195,
 "___syscall220": ___syscall220,
 "___syscall221": ___syscall221,
 "___syscall3": ___syscall3,
 "___syscall33": ___syscall33,
 "___syscall38": ___syscall38,
 "___syscall39": ___syscall39,
 "___syscall4": ___syscall4,
 "___syscall40": ___syscall40,
 "___syscall5": ___syscall5,
 "___syscall54": ___syscall54,
 "___syscall6": ___syscall6,
 "___syscall91": ___syscall91,
 "___unlock": ___unlock,
 "__computeUnpackAlignedImageSize": __computeUnpackAlignedImageSize,
 "__emscripten_do_request_fullscreen": __emscripten_do_request_fullscreen,
 "__emscripten_traverse_stack": __emscripten_traverse_stack,
 "__fillFullscreenChangeEventData": __fillFullscreenChangeEventData,
 "__fillGamepadEventData": __fillGamepadEventData,
 "__fillMouseEventData": __fillMouseEventData,
 "__fillPointerlockChangeEventData": __fillPointerlockChangeEventData,
 "__fillVisibilityChangeEventData": __fillVisibilityChangeEventData,
 "__findCanvasEventTarget": __findCanvasEventTarget,
 "__findEventTarget": __findEventTarget,
 "__formatString": __formatString,
 "__get_canvas_element_size": __get_canvas_element_size,
 "__glGenObject": __glGenObject,
 "__heapObjectForWebGLType": __heapObjectForWebGLType,
 "__hideEverythingExceptGivenElement": __hideEverythingExceptGivenElement,
 "__inet_ntop4_raw": __inet_ntop4_raw,
 "__inet_ntop6_raw": __inet_ntop6_raw,
 "__inet_pton4_raw": __inet_pton4_raw,
 "__inet_pton6_raw": __inet_pton6_raw,
 "__read_sockaddr": __read_sockaddr,
 "__reallyNegative": __reallyNegative,
 "__registerBeforeUnloadEventCallback": __registerBeforeUnloadEventCallback,
 "__registerFocusEventCallback": __registerFocusEventCallback,
 "__registerFullscreenChangeEventCallback": __registerFullscreenChangeEventCallback,
 "__registerGamepadEventCallback": __registerGamepadEventCallback,
 "__registerKeyEventCallback": __registerKeyEventCallback,
 "__registerMouseEventCallback": __registerMouseEventCallback,
 "__registerPointerlockChangeEventCallback": __registerPointerlockChangeEventCallback,
 "__registerRestoreOldStyle": __registerRestoreOldStyle,
 "__registerTouchEventCallback": __registerTouchEventCallback,
 "__registerUiEventCallback": __registerUiEventCallback,
 "__registerVisibilityChangeEventCallback": __registerVisibilityChangeEventCallback,
 "__registerWheelEventCallback": __registerWheelEventCallback,
 "__requestPointerLock": __requestPointerLock,
 "__restoreHiddenElements": __restoreHiddenElements,
 "__setLetterbox": __setLetterbox,
 "__set_canvas_element_size": __set_canvas_element_size,
 "__softFullscreenResizeWebGLRenderTarget": __softFullscreenResizeWebGLRenderTarget,
 "__write_sockaddr": __write_sockaddr,
 "_abort": _abort,
 "_alBufferData": _alBufferData,
 "_alDeleteBuffers": _alDeleteBuffers,
 "_alDeleteSources": _alDeleteSources,
 "_alDistanceModel": _alDistanceModel,
 "_alGenBuffers": _alGenBuffers,
 "_alGenSources": _alGenSources,
 "_alGetError": _alGetError,
 "_alGetSourcei": _alGetSourcei,
 "_alGetString": _alGetString,
 "_alSourcePause": _alSourcePause,
 "_alSourcePlay": _alSourcePlay,
 "_alSourceQueueBuffers": _alSourceQueueBuffers,
 "_alSourceStop": _alSourceStop,
 "_alSourceUnqueueBuffers": _alSourceUnqueueBuffers,
 "_alSourcef": _alSourcef,
 "_alSourcefv": _alSourcefv,
 "_alSourcei": _alSourcei,
 "_alcCloseDevice": _alcCloseDevice,
 "_alcCreateContext": _alcCreateContext,
 "_alcDestroyContext": _alcDestroyContext,
 "_alcGetString": _alcGetString,
 "_alcMakeContextCurrent": _alcMakeContextCurrent,
 "_alcOpenDevice": _alcOpenDevice,
 "_alcProcessContext": _alcProcessContext,
 "_clock_gettime": _clock_gettime,
 "_dlclose": _dlclose,
 "_dlopen": _dlopen,
 "_dlsym": _dlsym,
 "_eglBindAPI": _eglBindAPI,
 "_eglChooseConfig": _eglChooseConfig,
 "_eglCreateContext": _eglCreateContext,
 "_eglCreateWindowSurface": _eglCreateWindowSurface,
 "_eglDestroyContext": _eglDestroyContext,
 "_eglDestroySurface": _eglDestroySurface,
 "_eglGetConfigAttrib": _eglGetConfigAttrib,
 "_eglGetDisplay": _eglGetDisplay,
 "_eglGetError": _eglGetError,
 "_eglGetProcAddress": _eglGetProcAddress,
 "_eglInitialize": _eglInitialize,
 "_eglMakeCurrent": _eglMakeCurrent,
 "_eglQueryString": _eglQueryString,
 "_eglSwapBuffers": _eglSwapBuffers,
 "_eglSwapInterval": _eglSwapInterval,
 "_eglTerminate": _eglTerminate,
 "_eglWaitClient": _eglWaitClient,
 "_eglWaitGL": _eglWaitGL,
 "_eglWaitNative": _eglWaitNative,
 "_emscripten_asm_const_i": _emscripten_asm_const_i,
 "_emscripten_asm_const_ii": _emscripten_asm_const_ii,
 "_emscripten_asm_const_iii": _emscripten_asm_const_iii,
 "_emscripten_asm_const_iiii": _emscripten_asm_const_iiii,
 "_emscripten_asm_const_iiiii": _emscripten_asm_const_iiiii,
 "_emscripten_asm_const_iiiiii": _emscripten_asm_const_iiiiii,
 "_emscripten_asm_const_iiiiiiddi": _emscripten_asm_const_iiiiiiddi,
 "_emscripten_asm_const_iiiiiii": _emscripten_asm_const_iiiiiii,
 "_emscripten_asm_const_sync_on_main_thread_i": _emscripten_asm_const_sync_on_main_thread_i,
 "_emscripten_asm_const_sync_on_main_thread_ii": _emscripten_asm_const_sync_on_main_thread_ii,
 "_emscripten_enter_soft_fullscreen": _emscripten_enter_soft_fullscreen,
 "_emscripten_exit_fullscreen": _emscripten_exit_fullscreen,
 "_emscripten_exit_pointerlock": _emscripten_exit_pointerlock,
 "_emscripten_get_callstack": _emscripten_get_callstack,
 "_emscripten_get_callstack_js": _emscripten_get_callstack_js,
 "_emscripten_get_canvas_element_size": _emscripten_get_canvas_element_size,
 "_emscripten_get_device_pixel_ratio": _emscripten_get_device_pixel_ratio,
 "_emscripten_get_element_css_size": _emscripten_get_element_css_size,
 "_emscripten_get_fullscreen_status": _emscripten_get_fullscreen_status,
 "_emscripten_get_gamepad_status": _emscripten_get_gamepad_status,
 "_emscripten_get_heap_size": _emscripten_get_heap_size,
 "_emscripten_get_now": _emscripten_get_now,
 "_emscripten_get_now_is_monotonic": _emscripten_get_now_is_monotonic,
 "_emscripten_get_num_gamepads": _emscripten_get_num_gamepads,
 "_emscripten_get_pointerlock_status": _emscripten_get_pointerlock_status,
 "_emscripten_glActiveTexture": _emscripten_glActiveTexture,
 "_emscripten_glAttachShader": _emscripten_glAttachShader,
 "_emscripten_glBeginQuery": _emscripten_glBeginQuery,
 "_emscripten_glBeginQueryEXT": _emscripten_glBeginQueryEXT,
 "_emscripten_glBeginTransformFeedback": _emscripten_glBeginTransformFeedback,
 "_emscripten_glBindAttribLocation": _emscripten_glBindAttribLocation,
 "_emscripten_glBindBuffer": _emscripten_glBindBuffer,
 "_emscripten_glBindBufferBase": _emscripten_glBindBufferBase,
 "_emscripten_glBindBufferRange": _emscripten_glBindBufferRange,
 "_emscripten_glBindFramebuffer": _emscripten_glBindFramebuffer,
 "_emscripten_glBindRenderbuffer": _emscripten_glBindRenderbuffer,
 "_emscripten_glBindSampler": _emscripten_glBindSampler,
 "_emscripten_glBindTexture": _emscripten_glBindTexture,
 "_emscripten_glBindTransformFeedback": _emscripten_glBindTransformFeedback,
 "_emscripten_glBindVertexArray": _emscripten_glBindVertexArray,
 "_emscripten_glBindVertexArrayOES": _emscripten_glBindVertexArrayOES,
 "_emscripten_glBlendColor": _emscripten_glBlendColor,
 "_emscripten_glBlendEquation": _emscripten_glBlendEquation,
 "_emscripten_glBlendEquationSeparate": _emscripten_glBlendEquationSeparate,
 "_emscripten_glBlendFunc": _emscripten_glBlendFunc,
 "_emscripten_glBlendFuncSeparate": _emscripten_glBlendFuncSeparate,
 "_emscripten_glBlitFramebuffer": _emscripten_glBlitFramebuffer,
 "_emscripten_glBufferData": _emscripten_glBufferData,
 "_emscripten_glBufferSubData": _emscripten_glBufferSubData,
 "_emscripten_glCheckFramebufferStatus": _emscripten_glCheckFramebufferStatus,
 "_emscripten_glClear": _emscripten_glClear,
 "_emscripten_glClearBufferfi": _emscripten_glClearBufferfi,
 "_emscripten_glClearBufferfv": _emscripten_glClearBufferfv,
 "_emscripten_glClearBufferiv": _emscripten_glClearBufferiv,
 "_emscripten_glClearBufferuiv": _emscripten_glClearBufferuiv,
 "_emscripten_glClearColor": _emscripten_glClearColor,
 "_emscripten_glClearDepthf": _emscripten_glClearDepthf,
 "_emscripten_glClearStencil": _emscripten_glClearStencil,
 "_emscripten_glClientWaitSync": _emscripten_glClientWaitSync,
 "_emscripten_glColorMask": _emscripten_glColorMask,
 "_emscripten_glCompileShader": _emscripten_glCompileShader,
 "_emscripten_glCompressedTexImage2D": _emscripten_glCompressedTexImage2D,
 "_emscripten_glCompressedTexImage3D": _emscripten_glCompressedTexImage3D,
 "_emscripten_glCompressedTexSubImage2D": _emscripten_glCompressedTexSubImage2D,
 "_emscripten_glCompressedTexSubImage3D": _emscripten_glCompressedTexSubImage3D,
 "_emscripten_glCopyBufferSubData": _emscripten_glCopyBufferSubData,
 "_emscripten_glCopyTexImage2D": _emscripten_glCopyTexImage2D,
 "_emscripten_glCopyTexSubImage2D": _emscripten_glCopyTexSubImage2D,
 "_emscripten_glCopyTexSubImage3D": _emscripten_glCopyTexSubImage3D,
 "_emscripten_glCreateProgram": _emscripten_glCreateProgram,
 "_emscripten_glCreateShader": _emscripten_glCreateShader,
 "_emscripten_glCullFace": _emscripten_glCullFace,
 "_emscripten_glDeleteBuffers": _emscripten_glDeleteBuffers,
 "_emscripten_glDeleteFramebuffers": _emscripten_glDeleteFramebuffers,
 "_emscripten_glDeleteProgram": _emscripten_glDeleteProgram,
 "_emscripten_glDeleteQueries": _emscripten_glDeleteQueries,
 "_emscripten_glDeleteQueriesEXT": _emscripten_glDeleteQueriesEXT,
 "_emscripten_glDeleteRenderbuffers": _emscripten_glDeleteRenderbuffers,
 "_emscripten_glDeleteSamplers": _emscripten_glDeleteSamplers,
 "_emscripten_glDeleteShader": _emscripten_glDeleteShader,
 "_emscripten_glDeleteSync": _emscripten_glDeleteSync,
 "_emscripten_glDeleteTextures": _emscripten_glDeleteTextures,
 "_emscripten_glDeleteTransformFeedbacks": _emscripten_glDeleteTransformFeedbacks,
 "_emscripten_glDeleteVertexArrays": _emscripten_glDeleteVertexArrays,
 "_emscripten_glDeleteVertexArraysOES": _emscripten_glDeleteVertexArraysOES,
 "_emscripten_glDepthFunc": _emscripten_glDepthFunc,
 "_emscripten_glDepthMask": _emscripten_glDepthMask,
 "_emscripten_glDepthRangef": _emscripten_glDepthRangef,
 "_emscripten_glDetachShader": _emscripten_glDetachShader,
 "_emscripten_glDisable": _emscripten_glDisable,
 "_emscripten_glDisableVertexAttribArray": _emscripten_glDisableVertexAttribArray,
 "_emscripten_glDrawArrays": _emscripten_glDrawArrays,
 "_emscripten_glDrawArraysInstanced": _emscripten_glDrawArraysInstanced,
 "_emscripten_glDrawArraysInstancedANGLE": _emscripten_glDrawArraysInstancedANGLE,
 "_emscripten_glDrawArraysInstancedARB": _emscripten_glDrawArraysInstancedARB,
 "_emscripten_glDrawArraysInstancedEXT": _emscripten_glDrawArraysInstancedEXT,
 "_emscripten_glDrawArraysInstancedNV": _emscripten_glDrawArraysInstancedNV,
 "_emscripten_glDrawBuffers": _emscripten_glDrawBuffers,
 "_emscripten_glDrawBuffersEXT": _emscripten_glDrawBuffersEXT,
 "_emscripten_glDrawBuffersWEBGL": _emscripten_glDrawBuffersWEBGL,
 "_emscripten_glDrawElements": _emscripten_glDrawElements,
 "_emscripten_glDrawElementsInstanced": _emscripten_glDrawElementsInstanced,
 "_emscripten_glDrawElementsInstancedANGLE": _emscripten_glDrawElementsInstancedANGLE,
 "_emscripten_glDrawElementsInstancedARB": _emscripten_glDrawElementsInstancedARB,
 "_emscripten_glDrawElementsInstancedEXT": _emscripten_glDrawElementsInstancedEXT,
 "_emscripten_glDrawElementsInstancedNV": _emscripten_glDrawElementsInstancedNV,
 "_emscripten_glDrawRangeElements": _emscripten_glDrawRangeElements,
 "_emscripten_glEnable": _emscripten_glEnable,
 "_emscripten_glEnableVertexAttribArray": _emscripten_glEnableVertexAttribArray,
 "_emscripten_glEndQuery": _emscripten_glEndQuery,
 "_emscripten_glEndQueryEXT": _emscripten_glEndQueryEXT,
 "_emscripten_glEndTransformFeedback": _emscripten_glEndTransformFeedback,
 "_emscripten_glFenceSync": _emscripten_glFenceSync,
 "_emscripten_glFinish": _emscripten_glFinish,
 "_emscripten_glFlush": _emscripten_glFlush,
 "_emscripten_glFlushMappedBufferRange": _emscripten_glFlushMappedBufferRange,
 "_emscripten_glFramebufferRenderbuffer": _emscripten_glFramebufferRenderbuffer,
 "_emscripten_glFramebufferTexture2D": _emscripten_glFramebufferTexture2D,
 "_emscripten_glFramebufferTextureLayer": _emscripten_glFramebufferTextureLayer,
 "_emscripten_glFrontFace": _emscripten_glFrontFace,
 "_emscripten_glGenBuffers": _emscripten_glGenBuffers,
 "_emscripten_glGenFramebuffers": _emscripten_glGenFramebuffers,
 "_emscripten_glGenQueries": _emscripten_glGenQueries,
 "_emscripten_glGenQueriesEXT": _emscripten_glGenQueriesEXT,
 "_emscripten_glGenRenderbuffers": _emscripten_glGenRenderbuffers,
 "_emscripten_glGenSamplers": _emscripten_glGenSamplers,
 "_emscripten_glGenTextures": _emscripten_glGenTextures,
 "_emscripten_glGenTransformFeedbacks": _emscripten_glGenTransformFeedbacks,
 "_emscripten_glGenVertexArrays": _emscripten_glGenVertexArrays,
 "_emscripten_glGenVertexArraysOES": _emscripten_glGenVertexArraysOES,
 "_emscripten_glGenerateMipmap": _emscripten_glGenerateMipmap,
 "_emscripten_glGetActiveAttrib": _emscripten_glGetActiveAttrib,
 "_emscripten_glGetActiveUniform": _emscripten_glGetActiveUniform,
 "_emscripten_glGetActiveUniformBlockName": _emscripten_glGetActiveUniformBlockName,
 "_emscripten_glGetActiveUniformBlockiv": _emscripten_glGetActiveUniformBlockiv,
 "_emscripten_glGetActiveUniformsiv": _emscripten_glGetActiveUniformsiv,
 "_emscripten_glGetAttachedShaders": _emscripten_glGetAttachedShaders,
 "_emscripten_glGetAttribLocation": _emscripten_glGetAttribLocation,
 "_emscripten_glGetBooleanv": _emscripten_glGetBooleanv,
 "_emscripten_glGetBufferParameteri64v": _emscripten_glGetBufferParameteri64v,
 "_emscripten_glGetBufferParameteriv": _emscripten_glGetBufferParameteriv,
 "_emscripten_glGetBufferPointerv": _emscripten_glGetBufferPointerv,
 "_emscripten_glGetError": _emscripten_glGetError,
 "_emscripten_glGetFloatv": _emscripten_glGetFloatv,
 "_emscripten_glGetFragDataLocation": _emscripten_glGetFragDataLocation,
 "_emscripten_glGetFramebufferAttachmentParameteriv": _emscripten_glGetFramebufferAttachmentParameteriv,
 "_emscripten_glGetInteger64i_v": _emscripten_glGetInteger64i_v,
 "_emscripten_glGetInteger64v": _emscripten_glGetInteger64v,
 "_emscripten_glGetIntegeri_v": _emscripten_glGetIntegeri_v,
 "_emscripten_glGetIntegerv": _emscripten_glGetIntegerv,
 "_emscripten_glGetInternalformativ": _emscripten_glGetInternalformativ,
 "_emscripten_glGetProgramBinary": _emscripten_glGetProgramBinary,
 "_emscripten_glGetProgramInfoLog": _emscripten_glGetProgramInfoLog,
 "_emscripten_glGetProgramiv": _emscripten_glGetProgramiv,
 "_emscripten_glGetQueryObjecti64vEXT": _emscripten_glGetQueryObjecti64vEXT,
 "_emscripten_glGetQueryObjectivEXT": _emscripten_glGetQueryObjectivEXT,
 "_emscripten_glGetQueryObjectui64vEXT": _emscripten_glGetQueryObjectui64vEXT,
 "_emscripten_glGetQueryObjectuiv": _emscripten_glGetQueryObjectuiv,
 "_emscripten_glGetQueryObjectuivEXT": _emscripten_glGetQueryObjectuivEXT,
 "_emscripten_glGetQueryiv": _emscripten_glGetQueryiv,
 "_emscripten_glGetQueryivEXT": _emscripten_glGetQueryivEXT,
 "_emscripten_glGetRenderbufferParameteriv": _emscripten_glGetRenderbufferParameteriv,
 "_emscripten_glGetSamplerParameterfv": _emscripten_glGetSamplerParameterfv,
 "_emscripten_glGetSamplerParameteriv": _emscripten_glGetSamplerParameteriv,
 "_emscripten_glGetShaderInfoLog": _emscripten_glGetShaderInfoLog,
 "_emscripten_glGetShaderPrecisionFormat": _emscripten_glGetShaderPrecisionFormat,
 "_emscripten_glGetShaderSource": _emscripten_glGetShaderSource,
 "_emscripten_glGetShaderiv": _emscripten_glGetShaderiv,
 "_emscripten_glGetString": _emscripten_glGetString,
 "_emscripten_glGetStringi": _emscripten_glGetStringi,
 "_emscripten_glGetSynciv": _emscripten_glGetSynciv,
 "_emscripten_glGetTexParameterfv": _emscripten_glGetTexParameterfv,
 "_emscripten_glGetTexParameteriv": _emscripten_glGetTexParameteriv,
 "_emscripten_glGetTransformFeedbackVarying": _emscripten_glGetTransformFeedbackVarying,
 "_emscripten_glGetUniformBlockIndex": _emscripten_glGetUniformBlockIndex,
 "_emscripten_glGetUniformIndices": _emscripten_glGetUniformIndices,
 "_emscripten_glGetUniformLocation": _emscripten_glGetUniformLocation,
 "_emscripten_glGetUniformfv": _emscripten_glGetUniformfv,
 "_emscripten_glGetUniformiv": _emscripten_glGetUniformiv,
 "_emscripten_glGetUniformuiv": _emscripten_glGetUniformuiv,
 "_emscripten_glGetVertexAttribIiv": _emscripten_glGetVertexAttribIiv,
 "_emscripten_glGetVertexAttribIuiv": _emscripten_glGetVertexAttribIuiv,
 "_emscripten_glGetVertexAttribPointerv": _emscripten_glGetVertexAttribPointerv,
 "_emscripten_glGetVertexAttribfv": _emscripten_glGetVertexAttribfv,
 "_emscripten_glGetVertexAttribiv": _emscripten_glGetVertexAttribiv,
 "_emscripten_glHint": _emscripten_glHint,
 "_emscripten_glInvalidateFramebuffer": _emscripten_glInvalidateFramebuffer,
 "_emscripten_glInvalidateSubFramebuffer": _emscripten_glInvalidateSubFramebuffer,
 "_emscripten_glIsBuffer": _emscripten_glIsBuffer,
 "_emscripten_glIsEnabled": _emscripten_glIsEnabled,
 "_emscripten_glIsFramebuffer": _emscripten_glIsFramebuffer,
 "_emscripten_glIsProgram": _emscripten_glIsProgram,
 "_emscripten_glIsQuery": _emscripten_glIsQuery,
 "_emscripten_glIsQueryEXT": _emscripten_glIsQueryEXT,
 "_emscripten_glIsRenderbuffer": _emscripten_glIsRenderbuffer,
 "_emscripten_glIsSampler": _emscripten_glIsSampler,
 "_emscripten_glIsShader": _emscripten_glIsShader,
 "_emscripten_glIsSync": _emscripten_glIsSync,
 "_emscripten_glIsTexture": _emscripten_glIsTexture,
 "_emscripten_glIsTransformFeedback": _emscripten_glIsTransformFeedback,
 "_emscripten_glIsVertexArray": _emscripten_glIsVertexArray,
 "_emscripten_glIsVertexArrayOES": _emscripten_glIsVertexArrayOES,
 "_emscripten_glLineWidth": _emscripten_glLineWidth,
 "_emscripten_glLinkProgram": _emscripten_glLinkProgram,
 "_emscripten_glMapBufferRange": _emscripten_glMapBufferRange,
 "_emscripten_glPauseTransformFeedback": _emscripten_glPauseTransformFeedback,
 "_emscripten_glPixelStorei": _emscripten_glPixelStorei,
 "_emscripten_glPolygonOffset": _emscripten_glPolygonOffset,
 "_emscripten_glProgramBinary": _emscripten_glProgramBinary,
 "_emscripten_glProgramParameteri": _emscripten_glProgramParameteri,
 "_emscripten_glQueryCounterEXT": _emscripten_glQueryCounterEXT,
 "_emscripten_glReadBuffer": _emscripten_glReadBuffer,
 "_emscripten_glReadPixels": _emscripten_glReadPixels,
 "_emscripten_glReleaseShaderCompiler": _emscripten_glReleaseShaderCompiler,
 "_emscripten_glRenderbufferStorage": _emscripten_glRenderbufferStorage,
 "_emscripten_glRenderbufferStorageMultisample": _emscripten_glRenderbufferStorageMultisample,
 "_emscripten_glResumeTransformFeedback": _emscripten_glResumeTransformFeedback,
 "_emscripten_glSampleCoverage": _emscripten_glSampleCoverage,
 "_emscripten_glSamplerParameterf": _emscripten_glSamplerParameterf,
 "_emscripten_glSamplerParameterfv": _emscripten_glSamplerParameterfv,
 "_emscripten_glSamplerParameteri": _emscripten_glSamplerParameteri,
 "_emscripten_glSamplerParameteriv": _emscripten_glSamplerParameteriv,
 "_emscripten_glScissor": _emscripten_glScissor,
 "_emscripten_glShaderBinary": _emscripten_glShaderBinary,
 "_emscripten_glShaderSource": _emscripten_glShaderSource,
 "_emscripten_glStencilFunc": _emscripten_glStencilFunc,
 "_emscripten_glStencilFuncSeparate": _emscripten_glStencilFuncSeparate,
 "_emscripten_glStencilMask": _emscripten_glStencilMask,
 "_emscripten_glStencilMaskSeparate": _emscripten_glStencilMaskSeparate,
 "_emscripten_glStencilOp": _emscripten_glStencilOp,
 "_emscripten_glStencilOpSeparate": _emscripten_glStencilOpSeparate,
 "_emscripten_glTexImage2D": _emscripten_glTexImage2D,
 "_emscripten_glTexImage3D": _emscripten_glTexImage3D,
 "_emscripten_glTexParameterf": _emscripten_glTexParameterf,
 "_emscripten_glTexParameterfv": _emscripten_glTexParameterfv,
 "_emscripten_glTexParameteri": _emscripten_glTexParameteri,
 "_emscripten_glTexParameteriv": _emscripten_glTexParameteriv,
 "_emscripten_glTexStorage2D": _emscripten_glTexStorage2D,
 "_emscripten_glTexStorage3D": _emscripten_glTexStorage3D,
 "_emscripten_glTexSubImage2D": _emscripten_glTexSubImage2D,
 "_emscripten_glTexSubImage3D": _emscripten_glTexSubImage3D,
 "_emscripten_glTransformFeedbackVaryings": _emscripten_glTransformFeedbackVaryings,
 "_emscripten_glUniform1f": _emscripten_glUniform1f,
 "_emscripten_glUniform1fv": _emscripten_glUniform1fv,
 "_emscripten_glUniform1i": _emscripten_glUniform1i,
 "_emscripten_glUniform1iv": _emscripten_glUniform1iv,
 "_emscripten_glUniform1ui": _emscripten_glUniform1ui,
 "_emscripten_glUniform1uiv": _emscripten_glUniform1uiv,
 "_emscripten_glUniform2f": _emscripten_glUniform2f,
 "_emscripten_glUniform2fv": _emscripten_glUniform2fv,
 "_emscripten_glUniform2i": _emscripten_glUniform2i,
 "_emscripten_glUniform2iv": _emscripten_glUniform2iv,
 "_emscripten_glUniform2ui": _emscripten_glUniform2ui,
 "_emscripten_glUniform2uiv": _emscripten_glUniform2uiv,
 "_emscripten_glUniform3f": _emscripten_glUniform3f,
 "_emscripten_glUniform3fv": _emscripten_glUniform3fv,
 "_emscripten_glUniform3i": _emscripten_glUniform3i,
 "_emscripten_glUniform3iv": _emscripten_glUniform3iv,
 "_emscripten_glUniform3ui": _emscripten_glUniform3ui,
 "_emscripten_glUniform3uiv": _emscripten_glUniform3uiv,
 "_emscripten_glUniform4f": _emscripten_glUniform4f,
 "_emscripten_glUniform4fv": _emscripten_glUniform4fv,
 "_emscripten_glUniform4i": _emscripten_glUniform4i,
 "_emscripten_glUniform4iv": _emscripten_glUniform4iv,
 "_emscripten_glUniform4ui": _emscripten_glUniform4ui,
 "_emscripten_glUniform4uiv": _emscripten_glUniform4uiv,
 "_emscripten_glUniformBlockBinding": _emscripten_glUniformBlockBinding,
 "_emscripten_glUniformMatrix2fv": _emscripten_glUniformMatrix2fv,
 "_emscripten_glUniformMatrix2x3fv": _emscripten_glUniformMatrix2x3fv,
 "_emscripten_glUniformMatrix2x4fv": _emscripten_glUniformMatrix2x4fv,
 "_emscripten_glUniformMatrix3fv": _emscripten_glUniformMatrix3fv,
 "_emscripten_glUniformMatrix3x2fv": _emscripten_glUniformMatrix3x2fv,
 "_emscripten_glUniformMatrix3x4fv": _emscripten_glUniformMatrix3x4fv,
 "_emscripten_glUniformMatrix4fv": _emscripten_glUniformMatrix4fv,
 "_emscripten_glUniformMatrix4x2fv": _emscripten_glUniformMatrix4x2fv,
 "_emscripten_glUniformMatrix4x3fv": _emscripten_glUniformMatrix4x3fv,
 "_emscripten_glUnmapBuffer": _emscripten_glUnmapBuffer,
 "_emscripten_glUseProgram": _emscripten_glUseProgram,
 "_emscripten_glValidateProgram": _emscripten_glValidateProgram,
 "_emscripten_glVertexAttrib1f": _emscripten_glVertexAttrib1f,
 "_emscripten_glVertexAttrib1fv": _emscripten_glVertexAttrib1fv,
 "_emscripten_glVertexAttrib2f": _emscripten_glVertexAttrib2f,
 "_emscripten_glVertexAttrib2fv": _emscripten_glVertexAttrib2fv,
 "_emscripten_glVertexAttrib3f": _emscripten_glVertexAttrib3f,
 "_emscripten_glVertexAttrib3fv": _emscripten_glVertexAttrib3fv,
 "_emscripten_glVertexAttrib4f": _emscripten_glVertexAttrib4f,
 "_emscripten_glVertexAttrib4fv": _emscripten_glVertexAttrib4fv,
 "_emscripten_glVertexAttribDivisor": _emscripten_glVertexAttribDivisor,
 "_emscripten_glVertexAttribDivisorANGLE": _emscripten_glVertexAttribDivisorANGLE,
 "_emscripten_glVertexAttribDivisorARB": _emscripten_glVertexAttribDivisorARB,
 "_emscripten_glVertexAttribDivisorEXT": _emscripten_glVertexAttribDivisorEXT,
 "_emscripten_glVertexAttribDivisorNV": _emscripten_glVertexAttribDivisorNV,
 "_emscripten_glVertexAttribI4i": _emscripten_glVertexAttribI4i,
 "_emscripten_glVertexAttribI4iv": _emscripten_glVertexAttribI4iv,
 "_emscripten_glVertexAttribI4ui": _emscripten_glVertexAttribI4ui,
 "_emscripten_glVertexAttribI4uiv": _emscripten_glVertexAttribI4uiv,
 "_emscripten_glVertexAttribIPointer": _emscripten_glVertexAttribIPointer,
 "_emscripten_glVertexAttribPointer": _emscripten_glVertexAttribPointer,
 "_emscripten_glViewport": _emscripten_glViewport,
 "_emscripten_glWaitSync": _emscripten_glWaitSync,
 "_emscripten_log": _emscripten_log,
 "_emscripten_log_js": _emscripten_log_js,
 "_emscripten_longjmp": _emscripten_longjmp,
 "_emscripten_memcpy_big": _emscripten_memcpy_big,
 "_emscripten_request_fullscreen_strategy": _emscripten_request_fullscreen_strategy,
 "_emscripten_request_pointerlock": _emscripten_request_pointerlock,
 "_emscripten_resize_heap": _emscripten_resize_heap,
 "_emscripten_sample_gamepad_data": _emscripten_sample_gamepad_data,
 "_emscripten_set_beforeunload_callback_on_thread": _emscripten_set_beforeunload_callback_on_thread,
 "_emscripten_set_blur_callback_on_thread": _emscripten_set_blur_callback_on_thread,
 "_emscripten_set_canvas_element_size": _emscripten_set_canvas_element_size,
 "_emscripten_set_click_callback_on_thread": _emscripten_set_click_callback_on_thread,
 "_emscripten_set_element_css_size": _emscripten_set_element_css_size,
 "_emscripten_set_focus_callback_on_thread": _emscripten_set_focus_callback_on_thread,
 "_emscripten_set_fullscreenchange_callback_on_thread": _emscripten_set_fullscreenchange_callback_on_thread,
 "_emscripten_set_gamepadconnected_callback_on_thread": _emscripten_set_gamepadconnected_callback_on_thread,
 "_emscripten_set_gamepaddisconnected_callback_on_thread": _emscripten_set_gamepaddisconnected_callback_on_thread,
 "_emscripten_set_keydown_callback_on_thread": _emscripten_set_keydown_callback_on_thread,
 "_emscripten_set_keypress_callback_on_thread": _emscripten_set_keypress_callback_on_thread,
 "_emscripten_set_keyup_callback_on_thread": _emscripten_set_keyup_callback_on_thread,
 "_emscripten_set_main_loop": _emscripten_set_main_loop,
 "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
 "_emscripten_set_mousedown_callback_on_thread": _emscripten_set_mousedown_callback_on_thread,
 "_emscripten_set_mouseenter_callback_on_thread": _emscripten_set_mouseenter_callback_on_thread,
 "_emscripten_set_mouseleave_callback_on_thread": _emscripten_set_mouseleave_callback_on_thread,
 "_emscripten_set_mousemove_callback_on_thread": _emscripten_set_mousemove_callback_on_thread,
 "_emscripten_set_mouseup_callback_on_thread": _emscripten_set_mouseup_callback_on_thread,
 "_emscripten_set_pointerlockchange_callback_on_thread": _emscripten_set_pointerlockchange_callback_on_thread,
 "_emscripten_set_resize_callback_on_thread": _emscripten_set_resize_callback_on_thread,
 "_emscripten_set_touchcancel_callback_on_thread": _emscripten_set_touchcancel_callback_on_thread,
 "_emscripten_set_touchend_callback_on_thread": _emscripten_set_touchend_callback_on_thread,
 "_emscripten_set_touchmove_callback_on_thread": _emscripten_set_touchmove_callback_on_thread,
 "_emscripten_set_touchstart_callback_on_thread": _emscripten_set_touchstart_callback_on_thread,
 "_emscripten_set_visibilitychange_callback_on_thread": _emscripten_set_visibilitychange_callback_on_thread,
 "_emscripten_set_wheel_callback_on_thread": _emscripten_set_wheel_callback_on_thread,
 "_emscripten_webgl_create_context": _emscripten_webgl_create_context,
 "_emscripten_webgl_destroy_context": _emscripten_webgl_destroy_context,
 "_emscripten_webgl_destroy_context_calling_thread": _emscripten_webgl_destroy_context_calling_thread,
 "_emscripten_webgl_do_create_context": _emscripten_webgl_do_create_context,
 "_emscripten_webgl_do_get_current_context": _emscripten_webgl_do_get_current_context,
 "_emscripten_webgl_get_current_context": _emscripten_webgl_get_current_context,
 "_emscripten_webgl_init_context_attributes": _emscripten_webgl_init_context_attributes,
 "_emscripten_webgl_make_context_current": _emscripten_webgl_make_context_current,
 "_exit": _exit,
 "_getaddrinfo": _getaddrinfo,
 "_getenv": _getenv,
 "_gethostbyaddr": _gethostbyaddr,
 "_gethostbyname": _gethostbyname,
 "_getnameinfo": _getnameinfo,
 "_gettimeofday": _gettimeofday,
 "_glActiveTexture": _glActiveTexture,
 "_glAttachShader": _glAttachShader,
 "_glBindAttribLocation": _glBindAttribLocation,
 "_glBindBuffer": _glBindBuffer,
 "_glBindBufferRange": _glBindBufferRange,
 "_glBindFramebuffer": _glBindFramebuffer,
 "_glBindRenderbuffer": _glBindRenderbuffer,
 "_glBindTexture": _glBindTexture,
 "_glBlendEquation": _glBlendEquation,
 "_glBlendEquationSeparate": _glBlendEquationSeparate,
 "_glBlendFunc": _glBlendFunc,
 "_glBlendFuncSeparate": _glBlendFuncSeparate,
 "_glBlitFramebuffer": _glBlitFramebuffer,
 "_glBufferData": _glBufferData,
 "_glBufferSubData": _glBufferSubData,
 "_glCheckFramebufferStatus": _glCheckFramebufferStatus,
 "_glClear": _glClear,
 "_glClearBufferfi": _glClearBufferfi,
 "_glClearBufferfv": _glClearBufferfv,
 "_glClearBufferiv": _glClearBufferiv,
 "_glClearColor": _glClearColor,
 "_glClearDepthf": _glClearDepthf,
 "_glClearStencil": _glClearStencil,
 "_glColorMask": _glColorMask,
 "_glCompileShader": _glCompileShader,
 "_glCompressedTexImage2D": _glCompressedTexImage2D,
 "_glCompressedTexSubImage2D": _glCompressedTexSubImage2D,
 "_glCreateProgram": _glCreateProgram,
 "_glCreateShader": _glCreateShader,
 "_glCullFace": _glCullFace,
 "_glDeleteBuffers": _glDeleteBuffers,
 "_glDeleteFramebuffers": _glDeleteFramebuffers,
 "_glDeleteProgram": _glDeleteProgram,
 "_glDeleteRenderbuffers": _glDeleteRenderbuffers,
 "_glDeleteShader": _glDeleteShader,
 "_glDeleteTextures": _glDeleteTextures,
 "_glDepthFunc": _glDepthFunc,
 "_glDepthMask": _glDepthMask,
 "_glDepthRangef": _glDepthRangef,
 "_glDisable": _glDisable,
 "_glDisableVertexAttribArray": _glDisableVertexAttribArray,
 "_glDrawArrays": _glDrawArrays,
 "_glDrawArraysInstanced": _glDrawArraysInstanced,
 "_glDrawBuffers": _glDrawBuffers,
 "_glDrawElements": _glDrawElements,
 "_glDrawElementsInstanced": _glDrawElementsInstanced,
 "_glEnable": _glEnable,
 "_glEnableVertexAttribArray": _glEnableVertexAttribArray,
 "_glFlush": _glFlush,
 "_glFramebufferRenderbuffer": _glFramebufferRenderbuffer,
 "_glFramebufferTexture2D": _glFramebufferTexture2D,
 "_glGenBuffers": _glGenBuffers,
 "_glGenFramebuffers": _glGenFramebuffers,
 "_glGenRenderbuffers": _glGenRenderbuffers,
 "_glGenTextures": _glGenTextures,
 "_glGetBooleanv": _glGetBooleanv,
 "_glGetError": _glGetError,
 "_glGetIntegerv": _glGetIntegerv,
 "_glGetProgramInfoLog": _glGetProgramInfoLog,
 "_glGetProgramiv": _glGetProgramiv,
 "_glGetShaderInfoLog": _glGetShaderInfoLog,
 "_glGetShaderPrecisionFormat": _glGetShaderPrecisionFormat,
 "_glGetShaderiv": _glGetShaderiv,
 "_glGetString": _glGetString,
 "_glGetUniformLocation": _glGetUniformLocation,
 "_glLinkProgram": _glLinkProgram,
 "_glPixelStorei": _glPixelStorei,
 "_glPolygonOffset": _glPolygonOffset,
 "_glReadPixels": _glReadPixels,
 "_glRenderbufferStorage": _glRenderbufferStorage,
 "_glScissor": _glScissor,
 "_glShaderSource": _glShaderSource,
 "_glStencilFunc": _glStencilFunc,
 "_glStencilFuncSeparate": _glStencilFuncSeparate,
 "_glStencilMask": _glStencilMask,
 "_glStencilOp": _glStencilOp,
 "_glStencilOpSeparate": _glStencilOpSeparate,
 "_glTexImage2D": _glTexImage2D,
 "_glTexParameteri": _glTexParameteri,
 "_glTexSubImage2D": _glTexSubImage2D,
 "_glUniform1i": _glUniform1i,
 "_glUniform4fv": _glUniform4fv,
 "_glUniform4iv": _glUniform4iv,
 "_glUniform4uiv": _glUniform4uiv,
 "_glUseProgram": _glUseProgram,
 "_glVertexAttrib4fv": _glVertexAttrib4fv,
 "_glVertexAttribDivisor": _glVertexAttribDivisor,
 "_glVertexAttribPointer": _glVertexAttribPointer,
 "_glViewport": _glViewport,
 "_gmtime": _gmtime,
 "_gmtime_r": _gmtime_r,
 "_inet_addr": _inet_addr,
 "_llvm_bswap_i64": _llvm_bswap_i64,
 "_llvm_exp2_f32": _llvm_exp2_f32,
 "_llvm_exp2_f64": _llvm_exp2_f64,
 "_llvm_trap": _llvm_trap,
 "_localtime": _localtime,
 "_localtime_r": _localtime_r,
 "_longjmp": _longjmp,
 "_mktime": _mktime,
 "_nanosleep": _nanosleep,
 "_pthread_attr_destroy": _pthread_attr_destroy,
 "_pthread_attr_init": _pthread_attr_init,
 "_pthread_attr_setstacksize": _pthread_attr_setstacksize,
 "_pthread_cancel": _pthread_cancel,
 "_pthread_cond_destroy": _pthread_cond_destroy,
 "_pthread_cond_init": _pthread_cond_init,
 "_pthread_cond_timedwait": _pthread_cond_timedwait,
 "_pthread_cond_wait": _pthread_cond_wait,
 "_pthread_create": _pthread_create,
 "_pthread_exit": _pthread_exit,
 "_pthread_join": _pthread_join,
 "_pthread_mutexattr_destroy": _pthread_mutexattr_destroy,
 "_pthread_mutexattr_init": _pthread_mutexattr_init,
 "_pthread_mutexattr_setprotocol": _pthread_mutexattr_setprotocol,
 "_pthread_mutexattr_settype": _pthread_mutexattr_settype,
 "_sched_yield": _sched_yield,
 "_sigaction": _sigaction,
 "_signal": _signal,
 "_time": _time,
 "_tzset": _tzset,
 "_usleep": _usleep,
 "_utime": _utime,
 "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
 "emscriptenWebGLGet": emscriptenWebGLGet,
 "emscriptenWebGLGetIndexed": emscriptenWebGLGetIndexed,
 "emscriptenWebGLGetTexPixelData": emscriptenWebGLGetTexPixelData,
 "emscriptenWebGLGetUniform": emscriptenWebGLGetUniform,
 "emscriptenWebGLGetVertexAttrib": emscriptenWebGLGetVertexAttrib,
 "emscripten_realloc_buffer": emscripten_realloc_buffer,
 "stringToNewUTF8": stringToNewUTF8,
 "tempDoublePtr": tempDoublePtr,
 "DYNAMICTOP_PTR": DYNAMICTOP_PTR
};

var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);

var real____cxa_can_catch = asm["___cxa_can_catch"];

asm["___cxa_can_catch"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_demangle = asm["___cxa_demangle"];

asm["___cxa_demangle"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_demangle.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"];

asm["___cxa_is_pointer_type"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"];

asm["___errno_location"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____errno_location.apply(null, arguments);
};

var real___get_daylight = asm["__get_daylight"];

asm["__get_daylight"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___get_daylight.apply(null, arguments);
};

var real___get_environ = asm["__get_environ"];

asm["__get_environ"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___get_environ.apply(null, arguments);
};

var real___get_timezone = asm["__get_timezone"];

asm["__get_timezone"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___get_timezone.apply(null, arguments);
};

var real___get_tzname = asm["__get_tzname"];

asm["__get_tzname"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___get_tzname.apply(null, arguments);
};

var real__emscripten_GetProcAddress = asm["_emscripten_GetProcAddress"];

asm["_emscripten_GetProcAddress"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__emscripten_GetProcAddress.apply(null, arguments);
};

var real__fflush = asm["_fflush"];

asm["_fflush"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"];

asm["_free"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__free.apply(null, arguments);
};

var real__htonl = asm["_htonl"];

asm["_htonl"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__htonl.apply(null, arguments);
};

var real__htons = asm["_htons"];

asm["_htons"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__htons.apply(null, arguments);
};

var real__llvm_bswap_i16 = asm["_llvm_bswap_i16"];

asm["_llvm_bswap_i16"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_bswap_i16.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"];

asm["_llvm_bswap_i32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_bswap_i32.apply(null, arguments);
};

var real__llvm_rint_f32 = asm["_llvm_rint_f32"];

asm["_llvm_rint_f32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_rint_f32.apply(null, arguments);
};

var real__llvm_rint_f64 = asm["_llvm_rint_f64"];

asm["_llvm_rint_f64"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_rint_f64.apply(null, arguments);
};

var real__main = asm["_main"];

asm["_main"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__main.apply(null, arguments);
};

var real__malloc = asm["_malloc"];

asm["_malloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__malloc.apply(null, arguments);
};

var real__memalign = asm["_memalign"];

asm["_memalign"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__memalign.apply(null, arguments);
};

var real__memmove = asm["_memmove"];

asm["_memmove"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__memmove.apply(null, arguments);
};

var real__ntohs = asm["_ntohs"];

asm["_ntohs"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__ntohs.apply(null, arguments);
};

var real__on_fatal = asm["_on_fatal"];

asm["_on_fatal"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__on_fatal.apply(null, arguments);
};

var real__pthread_cond_broadcast = asm["_pthread_cond_broadcast"];

asm["_pthread_cond_broadcast"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__pthread_cond_broadcast.apply(null, arguments);
};

var real__realloc = asm["_realloc"];

asm["_realloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__realloc.apply(null, arguments);
};

var real__saveSetjmp = asm["_saveSetjmp"];

asm["_saveSetjmp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__saveSetjmp.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"];

asm["_sbrk"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__sbrk.apply(null, arguments);
};

var real__setThrew = asm["_setThrew"];

asm["_setThrew"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__setThrew.apply(null, arguments);
};

var real__strlen = asm["_strlen"];

asm["_strlen"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__strlen.apply(null, arguments);
};

var real__strstr = asm["_strstr"];

asm["_strstr"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__strstr.apply(null, arguments);
};

var real__testSetjmp = asm["_testSetjmp"];

asm["_testSetjmp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__testSetjmp.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"];

asm["establishStackSpace"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_establishStackSpace.apply(null, arguments);
};

var real_globalCtors = asm["globalCtors"];

asm["globalCtors"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_globalCtors.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"];

asm["stackAlloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"];

asm["stackRestore"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"];

asm["stackSave"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackSave.apply(null, arguments);
};

Module["asm"] = asm;

var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["___cxa_can_catch"].apply(null, arguments);
};

var ___cxa_demangle = Module["___cxa_demangle"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["___cxa_demangle"].apply(null, arguments);
};

var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments);
};

var ___errno_location = Module["___errno_location"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["___errno_location"].apply(null, arguments);
};

var __get_daylight = Module["__get_daylight"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["__get_daylight"].apply(null, arguments);
};

var __get_environ = Module["__get_environ"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["__get_environ"].apply(null, arguments);
};

var __get_timezone = Module["__get_timezone"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["__get_timezone"].apply(null, arguments);
};

var __get_tzname = Module["__get_tzname"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["__get_tzname"].apply(null, arguments);
};

var _emscripten_GetProcAddress = Module["_emscripten_GetProcAddress"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_emscripten_GetProcAddress"].apply(null, arguments);
};

var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments);
};

var _fflush = Module["_fflush"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_fflush"].apply(null, arguments);
};

var _free = Module["_free"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_free"].apply(null, arguments);
};

var _htonl = Module["_htonl"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_htonl"].apply(null, arguments);
};

var _htons = Module["_htons"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_htons"].apply(null, arguments);
};

var _llvm_bswap_i16 = Module["_llvm_bswap_i16"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_llvm_bswap_i16"].apply(null, arguments);
};

var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments);
};

var _llvm_rint_f32 = Module["_llvm_rint_f32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_llvm_rint_f32"].apply(null, arguments);
};

var _llvm_rint_f64 = Module["_llvm_rint_f64"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_llvm_rint_f64"].apply(null, arguments);
};

var _main = Module["_main"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_main"].apply(null, arguments);
};

var _malloc = Module["_malloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_malloc"].apply(null, arguments);
};

var _memalign = Module["_memalign"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_memalign"].apply(null, arguments);
};

var _memcpy = Module["_memcpy"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_memcpy"].apply(null, arguments);
};

var _memmove = Module["_memmove"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_memmove"].apply(null, arguments);
};

var _memset = Module["_memset"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_memset"].apply(null, arguments);
};

var _ntohs = Module["_ntohs"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_ntohs"].apply(null, arguments);
};

var _on_fatal = Module["_on_fatal"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_on_fatal"].apply(null, arguments);
};

var _pthread_cond_broadcast = Module["_pthread_cond_broadcast"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_pthread_cond_broadcast"].apply(null, arguments);
};

var _realloc = Module["_realloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_realloc"].apply(null, arguments);
};

var _saveSetjmp = Module["_saveSetjmp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_saveSetjmp"].apply(null, arguments);
};

var _sbrk = Module["_sbrk"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_sbrk"].apply(null, arguments);
};

var _setThrew = Module["_setThrew"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_setThrew"].apply(null, arguments);
};

var _strlen = Module["_strlen"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_strlen"].apply(null, arguments);
};

var _strstr = Module["_strstr"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_strstr"].apply(null, arguments);
};

var _testSetjmp = Module["_testSetjmp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["_testSetjmp"].apply(null, arguments);
};

var establishStackSpace = Module["establishStackSpace"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["establishStackSpace"].apply(null, arguments);
};

var globalCtors = Module["globalCtors"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["globalCtors"].apply(null, arguments);
};

var stackAlloc = Module["stackAlloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["stackAlloc"].apply(null, arguments);
};

var stackRestore = Module["stackRestore"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["stackRestore"].apply(null, arguments);
};

var stackSave = Module["stackSave"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["stackSave"].apply(null, arguments);
};

var dynCall_di = Module["dynCall_di"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_di"].apply(null, arguments);
};

var dynCall_did = Module["dynCall_did"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_did"].apply(null, arguments);
};

var dynCall_didd = Module["dynCall_didd"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_didd"].apply(null, arguments);
};

var dynCall_dif = Module["dynCall_dif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_dif"].apply(null, arguments);
};

var dynCall_dii = Module["dynCall_dii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_dii"].apply(null, arguments);
};

var dynCall_diid = Module["dynCall_diid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_diid"].apply(null, arguments);
};

var dynCall_diii = Module["dynCall_diii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_diii"].apply(null, arguments);
};

var dynCall_f = Module["dynCall_f"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_f"].apply(null, arguments);
};

var dynCall_fi = Module["dynCall_fi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fi"].apply(null, arguments);
};

var dynCall_fif = Module["dynCall_fif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fif"].apply(null, arguments);
};

var dynCall_fiff = Module["dynCall_fiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiff"].apply(null, arguments);
};

var dynCall_fiffi = Module["dynCall_fiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiffi"].apply(null, arguments);
};

var dynCall_fifi = Module["dynCall_fifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fifi"].apply(null, arguments);
};

var dynCall_fifii = Module["dynCall_fifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fifii"].apply(null, arguments);
};

var dynCall_fifiii = Module["dynCall_fifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fifiii"].apply(null, arguments);
};

var dynCall_fii = Module["dynCall_fii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fii"].apply(null, arguments);
};

var dynCall_fiif = Module["dynCall_fiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiif"].apply(null, arguments);
};

var dynCall_fiifi = Module["dynCall_fiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiifi"].apply(null, arguments);
};

var dynCall_fiifiii = Module["dynCall_fiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiifiii"].apply(null, arguments);
};

var dynCall_fiii = Module["dynCall_fiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiii"].apply(null, arguments);
};

var dynCall_fiiif = Module["dynCall_fiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiif"].apply(null, arguments);
};

var dynCall_fiiii = Module["dynCall_fiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiii"].apply(null, arguments);
};

var dynCall_fiiiiiif = Module["dynCall_fiiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiif"].apply(null, arguments);
};

var dynCall_fiiiiiifi = Module["dynCall_fiiiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiifi"].apply(null, arguments);
};

var dynCall_fiiiiiifiifif = Module["dynCall_fiiiiiifiifif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiifiifif"].apply(null, arguments);
};

var dynCall_fiiiiiifiiiif = Module["dynCall_fiiiiiifiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiifiiiif"].apply(null, arguments);
};

var dynCall_fiiiiiii = Module["dynCall_fiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiii"].apply(null, arguments);
};

var dynCall_fiiiiiiii = Module["dynCall_fiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiiiiiii"].apply(null, arguments);
};

var dynCall_fiiijiijiijii = Module["dynCall_fiiijiijiijii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fiiijiijiijii"].apply(null, arguments);
};

var dynCall_fij = Module["dynCall_fij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_fij"].apply(null, arguments);
};

var dynCall_i = Module["dynCall_i"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_i"].apply(null, arguments);
};

var dynCall_if = Module["dynCall_if"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_if"].apply(null, arguments);
};

var dynCall_ii = Module["dynCall_ii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_ii"].apply(null, arguments);
};

var dynCall_iid = Module["dynCall_iid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iid"].apply(null, arguments);
};

var dynCall_iidf = Module["dynCall_iidf"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidf"].apply(null, arguments);
};

var dynCall_iidfi = Module["dynCall_iidfi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidfi"].apply(null, arguments);
};

var dynCall_iidi = Module["dynCall_iidi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidi"].apply(null, arguments);
};

var dynCall_iidii = Module["dynCall_iidii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidii"].apply(null, arguments);
};

var dynCall_iidiii = Module["dynCall_iidiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidiii"].apply(null, arguments);
};

var dynCall_iidiiii = Module["dynCall_iidiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iidiiii"].apply(null, arguments);
};

var dynCall_iif = Module["dynCall_iif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iif"].apply(null, arguments);
};

var dynCall_iiff = Module["dynCall_iiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiff"].apply(null, arguments);
};

var dynCall_iifff = Module["dynCall_iifff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifff"].apply(null, arguments);
};

var dynCall_iifffffii = Module["dynCall_iifffffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifffffii"].apply(null, arguments);
};

var dynCall_iiffffi = Module["dynCall_iiffffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiffffi"].apply(null, arguments);
};

var dynCall_iiffi = Module["dynCall_iiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiffi"].apply(null, arguments);
};

var dynCall_iiffif = Module["dynCall_iiffif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiffif"].apply(null, arguments);
};

var dynCall_iiffii = Module["dynCall_iiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiffii"].apply(null, arguments);
};

var dynCall_iiffiiiiii = Module["dynCall_iiffiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiffiiiiii"].apply(null, arguments);
};

var dynCall_iifi = Module["dynCall_iifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifi"].apply(null, arguments);
};

var dynCall_iififi = Module["dynCall_iififi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iififi"].apply(null, arguments);
};

var dynCall_iifii = Module["dynCall_iifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifii"].apply(null, arguments);
};

var dynCall_iifiii = Module["dynCall_iifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiii"].apply(null, arguments);
};

var dynCall_iifiiif = Module["dynCall_iifiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiiif"].apply(null, arguments);
};

var dynCall_iifiiifiiiiiiii = Module["dynCall_iifiiifiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiiifiiiiiiii"].apply(null, arguments);
};

var dynCall_iifiiii = Module["dynCall_iifiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiiii"].apply(null, arguments);
};

var dynCall_iifiiiiiiii = Module["dynCall_iifiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiiiiiiii"].apply(null, arguments);
};

var dynCall_iifiiiiij = Module["dynCall_iifiiiiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iifiiiiij"].apply(null, arguments);
};

var dynCall_iii = Module["dynCall_iii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iii"].apply(null, arguments);
};

var dynCall_iiiddii = Module["dynCall_iiiddii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiddii"].apply(null, arguments);
};

var dynCall_iiidi = Module["dynCall_iiidi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiidi"].apply(null, arguments);
};

var dynCall_iiif = Module["dynCall_iiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiif"].apply(null, arguments);
};

var dynCall_iiiff = Module["dynCall_iiiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiff"].apply(null, arguments);
};

var dynCall_iiiffffiifii = Module["dynCall_iiiffffiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiffffiifii"].apply(null, arguments);
};

var dynCall_iiiffi = Module["dynCall_iiiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiffi"].apply(null, arguments);
};

var dynCall_iiiffii = Module["dynCall_iiiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiffii"].apply(null, arguments);
};

var dynCall_iiifi = Module["dynCall_iiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiifi"].apply(null, arguments);
};

var dynCall_iiifii = Module["dynCall_iiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiifii"].apply(null, arguments);
};

var dynCall_iiifiifi = Module["dynCall_iiifiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiifiifi"].apply(null, arguments);
};

var dynCall_iiifiii = Module["dynCall_iiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiifiii"].apply(null, arguments);
};

var dynCall_iiifiiiif = Module["dynCall_iiifiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiifiiiif"].apply(null, arguments);
};

var dynCall_iiii = Module["dynCall_iiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiii"].apply(null, arguments);
};

var dynCall_iiiiddii = Module["dynCall_iiiiddii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiddii"].apply(null, arguments);
};

var dynCall_iiiidi = Module["dynCall_iiiidi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiidi"].apply(null, arguments);
};

var dynCall_iiiidii = Module["dynCall_iiiidii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiidii"].apply(null, arguments);
};

var dynCall_iiiif = Module["dynCall_iiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiif"].apply(null, arguments);
};

var dynCall_iiiiffffi = Module["dynCall_iiiiffffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiffffi"].apply(null, arguments);
};

var dynCall_iiiiffi = Module["dynCall_iiiiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiffi"].apply(null, arguments);
};

var dynCall_iiiiffii = Module["dynCall_iiiiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiffii"].apply(null, arguments);
};

var dynCall_iiiiffiii = Module["dynCall_iiiiffiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiffiii"].apply(null, arguments);
};

var dynCall_iiiiffiiiiiii = Module["dynCall_iiiiffiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiffiiiiiii"].apply(null, arguments);
};

var dynCall_iiiifi = Module["dynCall_iiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiifi"].apply(null, arguments);
};

var dynCall_iiiifii = Module["dynCall_iiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiifii"].apply(null, arguments);
};

var dynCall_iiiifiii = Module["dynCall_iiiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiifiii"].apply(null, arguments);
};

var dynCall_iiiifiiii = Module["dynCall_iiiifiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiifiiii"].apply(null, arguments);
};

var dynCall_iiiifiiiii = Module["dynCall_iiiifiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiifiiiii"].apply(null, arguments);
};

var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiii"].apply(null, arguments);
};

var dynCall_iiiiif = Module["dynCall_iiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiif"].apply(null, arguments);
};

var dynCall_iiiiiffii = Module["dynCall_iiiiiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiffii"].apply(null, arguments);
};

var dynCall_iiiiifi = Module["dynCall_iiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiifi"].apply(null, arguments);
};

var dynCall_iiiiifii = Module["dynCall_iiiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiifii"].apply(null, arguments);
};

var dynCall_iiiiifiii = Module["dynCall_iiiiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiifiii"].apply(null, arguments);
};

var dynCall_iiiiifiiiif = Module["dynCall_iiiiifiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiifiiiif"].apply(null, arguments);
};

var dynCall_iiiiifiiiiif = Module["dynCall_iiiiifiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiifiiiiif"].apply(null, arguments);
};

var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiii"].apply(null, arguments);
};

var dynCall_iiiiiidii = Module["dynCall_iiiiiidii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiidii"].apply(null, arguments);
};

var dynCall_iiiiiif = Module["dynCall_iiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiif"].apply(null, arguments);
};

var dynCall_iiiiiiffii = Module["dynCall_iiiiiiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiffii"].apply(null, arguments);
};

var dynCall_iiiiiifi = Module["dynCall_iiiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiifi"].apply(null, arguments);
};

var dynCall_iiiiiifii = Module["dynCall_iiiiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiifii"].apply(null, arguments);
};

var dynCall_iiiiiifiif = Module["dynCall_iiiiiifiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiifiif"].apply(null, arguments);
};

var dynCall_iiiiiifiii = Module["dynCall_iiiiiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiifiii"].apply(null, arguments);
};

var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiifi = Module["dynCall_iiiiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiifi"].apply(null, arguments);
};

var dynCall_iiiiiiifii = Module["dynCall_iiiiiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiifii"].apply(null, arguments);
};

var dynCall_iiiiiiifiif = Module["dynCall_iiiiiiifiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiifiif"].apply(null, arguments);
};

var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiif = Module["dynCall_iiiiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiif"].apply(null, arguments);
};

var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiiiii = Module["dynCall_iiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiiiiii = Module["dynCall_iiiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiiiiiii"].apply(null, arguments);
};

var dynCall_iiiiiiiiiji = Module["dynCall_iiiiiiiiiji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiiiiiji"].apply(null, arguments);
};

var dynCall_iiiiiij = Module["dynCall_iiiiiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiiiij"].apply(null, arguments);
};

var dynCall_iiiij = Module["dynCall_iiiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiij"].apply(null, arguments);
};

var dynCall_iiij = Module["dynCall_iiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiij"].apply(null, arguments);
};

var dynCall_iiiji = Module["dynCall_iiiji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiiji"].apply(null, arguments);
};

var dynCall_iiijj = Module["dynCall_iiijj"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiijj"].apply(null, arguments);
};

var dynCall_iij = Module["dynCall_iij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iij"].apply(null, arguments);
};

var dynCall_iiji = Module["dynCall_iiji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iiji"].apply(null, arguments);
};

var dynCall_iijii = Module["dynCall_iijii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijii"].apply(null, arguments);
};

var dynCall_iijiii = Module["dynCall_iijiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijiii"].apply(null, arguments);
};

var dynCall_iijiiii = Module["dynCall_iijiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijiiii"].apply(null, arguments);
};

var dynCall_iijj = Module["dynCall_iijj"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijj"].apply(null, arguments);
};

var dynCall_iijji = Module["dynCall_iijji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijji"].apply(null, arguments);
};

var dynCall_iijjiii = Module["dynCall_iijjiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijjiii"].apply(null, arguments);
};

var dynCall_iijjji = Module["dynCall_iijjji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_iijjji"].apply(null, arguments);
};

var dynCall_ji = Module["dynCall_ji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_ji"].apply(null, arguments);
};

var dynCall_jii = Module["dynCall_jii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jii"].apply(null, arguments);
};

var dynCall_jiii = Module["dynCall_jiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiii"].apply(null, arguments);
};

var dynCall_jiiii = Module["dynCall_jiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiiii"].apply(null, arguments);
};

var dynCall_jiiiiii = Module["dynCall_jiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiiiiii"].apply(null, arguments);
};

var dynCall_jiiiiiiii = Module["dynCall_jiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiiiiiiii"].apply(null, arguments);
};

var dynCall_jiij = Module["dynCall_jiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiij"].apply(null, arguments);
};

var dynCall_jij = Module["dynCall_jij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jij"].apply(null, arguments);
};

var dynCall_jiji = Module["dynCall_jiji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_jiji"].apply(null, arguments);
};

var dynCall_v = Module["dynCall_v"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_v"].apply(null, arguments);
};

var dynCall_vf = Module["dynCall_vf"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vf"].apply(null, arguments);
};

var dynCall_vff = Module["dynCall_vff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vff"].apply(null, arguments);
};

var dynCall_vffff = Module["dynCall_vffff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vffff"].apply(null, arguments);
};

var dynCall_vfi = Module["dynCall_vfi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vfi"].apply(null, arguments);
};

var dynCall_vi = Module["dynCall_vi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vi"].apply(null, arguments);
};

var dynCall_vid = Module["dynCall_vid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vid"].apply(null, arguments);
};

var dynCall_vidi = Module["dynCall_vidi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vidi"].apply(null, arguments);
};

var dynCall_vidii = Module["dynCall_vidii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vidii"].apply(null, arguments);
};

var dynCall_vidiiii = Module["dynCall_vidiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vidiiii"].apply(null, arguments);
};

var dynCall_vidiiiii = Module["dynCall_vidiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vidiiiii"].apply(null, arguments);
};

var dynCall_vif = Module["dynCall_vif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vif"].apply(null, arguments);
};

var dynCall_viff = Module["dynCall_viff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viff"].apply(null, arguments);
};

var dynCall_vifff = Module["dynCall_vifff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifff"].apply(null, arguments);
};

var dynCall_viffff = Module["dynCall_viffff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffff"].apply(null, arguments);
};

var dynCall_viffffff = Module["dynCall_viffffff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffffff"].apply(null, arguments);
};

var dynCall_viffffffffffffiiii = Module["dynCall_viffffffffffffiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffffffffffffiiii"].apply(null, arguments);
};

var dynCall_viffffi = Module["dynCall_viffffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffffi"].apply(null, arguments);
};

var dynCall_vifffiii = Module["dynCall_vifffiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifffiii"].apply(null, arguments);
};

var dynCall_viffi = Module["dynCall_viffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffi"].apply(null, arguments);
};

var dynCall_viffif = Module["dynCall_viffif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffif"].apply(null, arguments);
};

var dynCall_viffiff = Module["dynCall_viffiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffiff"].apply(null, arguments);
};

var dynCall_viffii = Module["dynCall_viffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffii"].apply(null, arguments);
};

var dynCall_viffiifiiiii = Module["dynCall_viffiifiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffiifiiiii"].apply(null, arguments);
};

var dynCall_viffiiiii = Module["dynCall_viffiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viffiiiii"].apply(null, arguments);
};

var dynCall_vifi = Module["dynCall_vifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifi"].apply(null, arguments);
};

var dynCall_vififfi = Module["dynCall_vififfi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vififfi"].apply(null, arguments);
};

var dynCall_vifii = Module["dynCall_vifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifii"].apply(null, arguments);
};

var dynCall_vifiifi = Module["dynCall_vifiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiifi"].apply(null, arguments);
};

var dynCall_vifiifiifiiiii = Module["dynCall_vifiifiifiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiifiifiiiii"].apply(null, arguments);
};

var dynCall_vifiii = Module["dynCall_vifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiii"].apply(null, arguments);
};

var dynCall_vifiiifiiiiiiii = Module["dynCall_vifiiifiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiiifiiiiiiii"].apply(null, arguments);
};

var dynCall_vifiiii = Module["dynCall_vifiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiiii"].apply(null, arguments);
};

var dynCall_vifiiiiii = Module["dynCall_vifiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiiiiii"].apply(null, arguments);
};

var dynCall_vifiiiiiii = Module["dynCall_vifiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiiiiiii"].apply(null, arguments);
};

var dynCall_vifiiiiiiii = Module["dynCall_vifiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vifiiiiiiii"].apply(null, arguments);
};

var dynCall_vii = Module["dynCall_vii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vii"].apply(null, arguments);
};

var dynCall_viid = Module["dynCall_viid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viid"].apply(null, arguments);
};

var dynCall_viidddd = Module["dynCall_viidddd"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viidddd"].apply(null, arguments);
};

var dynCall_viidf = Module["dynCall_viidf"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viidf"].apply(null, arguments);
};

var dynCall_viif = Module["dynCall_viif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viif"].apply(null, arguments);
};

var dynCall_viiff = Module["dynCall_viiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiff"].apply(null, arguments);
};

var dynCall_viifff = Module["dynCall_viifff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifff"].apply(null, arguments);
};

var dynCall_viiffffffffiiii = Module["dynCall_viiffffffffiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffffffffiiii"].apply(null, arguments);
};

var dynCall_viiffffffii = Module["dynCall_viiffffffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffffffii"].apply(null, arguments);
};

var dynCall_viiffffiiii = Module["dynCall_viiffffiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffffiiii"].apply(null, arguments);
};

var dynCall_viifffi = Module["dynCall_viifffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifffi"].apply(null, arguments);
};

var dynCall_viiffi = Module["dynCall_viiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffi"].apply(null, arguments);
};

var dynCall_viiffifi = Module["dynCall_viiffifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffifi"].apply(null, arguments);
};

var dynCall_viiffii = Module["dynCall_viiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffii"].apply(null, arguments);
};

var dynCall_viiffiiiffffi = Module["dynCall_viiffiiiffffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiffiiiffffi"].apply(null, arguments);
};

var dynCall_viifi = Module["dynCall_viifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifi"].apply(null, arguments);
};

var dynCall_viififi = Module["dynCall_viififi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viififi"].apply(null, arguments);
};

var dynCall_viifii = Module["dynCall_viifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifii"].apply(null, arguments);
};

var dynCall_viifiiff = Module["dynCall_viifiiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiiff"].apply(null, arguments);
};

var dynCall_viifiifi = Module["dynCall_viifiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiifi"].apply(null, arguments);
};

var dynCall_viifiii = Module["dynCall_viifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiii"].apply(null, arguments);
};

var dynCall_viifiiii = Module["dynCall_viifiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiiii"].apply(null, arguments);
};

var dynCall_viifiiiii = Module["dynCall_viifiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiiiii"].apply(null, arguments);
};

var dynCall_viifiiiiiii = Module["dynCall_viifiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viifiiiiiii"].apply(null, arguments);
};

var dynCall_viii = Module["dynCall_viii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viii"].apply(null, arguments);
};

var dynCall_viiidddd = Module["dynCall_viiidddd"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiidddd"].apply(null, arguments);
};

var dynCall_viiidi = Module["dynCall_viiidi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiidi"].apply(null, arguments);
};

var dynCall_viiif = Module["dynCall_viiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiif"].apply(null, arguments);
};

var dynCall_viiiff = Module["dynCall_viiiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiff"].apply(null, arguments);
};

var dynCall_viiifi = Module["dynCall_viiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifi"].apply(null, arguments);
};

var dynCall_viiifif = Module["dynCall_viiifif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifif"].apply(null, arguments);
};

var dynCall_viiifii = Module["dynCall_viiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifii"].apply(null, arguments);
};

var dynCall_viiifiif = Module["dynCall_viiifiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifiif"].apply(null, arguments);
};

var dynCall_viiifiiffii = Module["dynCall_viiifiiffii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifiiffii"].apply(null, arguments);
};

var dynCall_viiifiii = Module["dynCall_viiifiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifiii"].apply(null, arguments);
};

var dynCall_viiifiiiii = Module["dynCall_viiifiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiifiiiii"].apply(null, arguments);
};

var dynCall_viiii = Module["dynCall_viiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiii"].apply(null, arguments);
};

var dynCall_viiiid = Module["dynCall_viiiid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiid"].apply(null, arguments);
};

var dynCall_viiiif = Module["dynCall_viiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiif"].apply(null, arguments);
};

var dynCall_viiiiffi = Module["dynCall_viiiiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiffi"].apply(null, arguments);
};

var dynCall_viiiifi = Module["dynCall_viiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiifi"].apply(null, arguments);
};

var dynCall_viiiifii = Module["dynCall_viiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiifii"].apply(null, arguments);
};

var dynCall_viiiifiif = Module["dynCall_viiiifiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiifiif"].apply(null, arguments);
};

var dynCall_viiiifiiiiif = Module["dynCall_viiiifiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiifiiiiif"].apply(null, arguments);
};

var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiii"].apply(null, arguments);
};

var dynCall_viiiiif = Module["dynCall_viiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiif"].apply(null, arguments);
};

var dynCall_viiiiiff = Module["dynCall_viiiiiff"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiff"].apply(null, arguments);
};

var dynCall_viiiiiffi = Module["dynCall_viiiiiffi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiffi"].apply(null, arguments);
};

var dynCall_viiiiifi = Module["dynCall_viiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiifi"].apply(null, arguments);
};

var dynCall_viiiiifii = Module["dynCall_viiiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiifii"].apply(null, arguments);
};

var dynCall_viiiiifiiiif = Module["dynCall_viiiiifiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiifiiiif"].apply(null, arguments);
};

var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiii"].apply(null, arguments);
};

var dynCall_viiiiiid = Module["dynCall_viiiiiid"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiid"].apply(null, arguments);
};

var dynCall_viiiiiifi = Module["dynCall_viiiiiifi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiifi"].apply(null, arguments);
};

var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiif = Module["dynCall_viiiiiiif"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiif"].apply(null, arguments);
};

var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiiiiifii = Module["dynCall_viiiiiiiiiiifii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiiiifii"].apply(null, arguments);
};

var dynCall_viiiiiiiiiiii = Module["dynCall_viiiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiiii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiiiiiiiiiiii"].apply(null, arguments);
};

var dynCall_viiiij = Module["dynCall_viiiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiiij"].apply(null, arguments);
};

var dynCall_viiij = Module["dynCall_viiij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiij"].apply(null, arguments);
};

var dynCall_viiijji = Module["dynCall_viiijji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiijji"].apply(null, arguments);
};

var dynCall_viij = Module["dynCall_viij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viij"].apply(null, arguments);
};

var dynCall_viiji = Module["dynCall_viiji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viiji"].apply(null, arguments);
};

var dynCall_viijii = Module["dynCall_viijii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viijii"].apply(null, arguments);
};

var dynCall_viijijj = Module["dynCall_viijijj"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viijijj"].apply(null, arguments);
};

var dynCall_viijj = Module["dynCall_viijj"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viijj"].apply(null, arguments);
};

var dynCall_viijjjii = Module["dynCall_viijjjii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viijjjii"].apply(null, arguments);
};

var dynCall_vij = Module["dynCall_vij"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vij"].apply(null, arguments);
};

var dynCall_viji = Module["dynCall_viji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_viji"].apply(null, arguments);
};

var dynCall_vijii = Module["dynCall_vijii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vijii"].apply(null, arguments);
};

var dynCall_vijji = Module["dynCall_vijji"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vijji"].apply(null, arguments);
};

var dynCall_vijjjii = Module["dynCall_vijjjii"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vijjjii"].apply(null, arguments);
};

var dynCall_vj = Module["dynCall_vj"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vj"].apply(null, arguments);
};

var dynCall_vjfi = Module["dynCall_vjfi"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return Module["asm"]["dynCall_vjfi"].apply(null, arguments);
};

Module["asm"] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() {
 abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["intArrayToString"]) Module["intArrayToString"] = function() {
 abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["ccall"]) Module["ccall"] = function() {
 abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["cwrap"]) Module["cwrap"] = function() {
 abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setValue"]) Module["setValue"] = function() {
 abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getValue"]) Module["getValue"] = function() {
 abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocate"]) Module["allocate"] = function() {
 abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

Module["getMemory"] = getMemory;

if (!Module["AsciiToString"]) Module["AsciiToString"] = function() {
 abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToAscii"]) Module["stringToAscii"] = function() {
 abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() {
 abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() {
 abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() {
 abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() {
 abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() {
 abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() {
 abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() {
 abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() {
 abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() {
 abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() {
 abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() {
 abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() {
 abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

Module["stackTrace"] = stackTrace;

if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() {
 abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnInit"]) Module["addOnInit"] = function() {
 abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() {
 abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnExit"]) Module["addOnExit"] = function() {
 abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() {
 abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() {
 abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() {
 abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

Module["writeAsciiToMemory"] = writeAsciiToMemory;

Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

if (!Module["ENV"]) Module["ENV"] = function() {
 abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["FS"]) Module["FS"] = function() {
 abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

Module["FS_createFolder"] = FS.createFolder;

Module["FS_createPath"] = FS.createPath;

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

Module["FS_createLazyFile"] = FS.createLazyFile;

Module["FS_createLink"] = FS.createLink;

Module["FS_createDevice"] = FS.createDevice;

Module["FS_unlink"] = FS.unlink;

if (!Module["GL"]) Module["GL"] = function() {
 abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() {
 abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["warnOnce"]) Module["warnOnce"] = function() {
 abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() {
 abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() {
 abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getLEB"]) Module["getLEB"] = function() {
 abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() {
 abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() {
 abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["registerFunctions"]) Module["registerFunctions"] = function() {
 abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addFunction"]) Module["addFunction"] = function() {
 abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["removeFunction"]) Module["removeFunction"] = function() {
 abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() {
 abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["prettyPrint"]) Module["prettyPrint"] = function() {
 abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["makeBigInt"]) Module["makeBigInt"] = function() {
 abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynCall"]) Module["dynCall"] = function() {
 abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() {
 abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackSave"]) Module["stackSave"] = function() {
 abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackRestore"]) Module["stackRestore"] = function() {
 abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackAlloc"]) Module["stackAlloc"] = function() {
 abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() {
 abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["print"]) Module["print"] = function() {
 abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["printErr"]) Module["printErr"] = function() {
 abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getTempRet0"]) Module["getTempRet0"] = function() {
 abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setTempRet0"]) Module["setTempRet0"] = function() {
 abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

Module["Pointer_stringify"] = Pointer_stringify;

if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", {
 get: function() {
  abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", {
 get: function() {
  abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", {
 get: function() {
  abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", {
 get: function() {
  abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

ExitStatus.prototype = new Error();

ExitStatus.prototype.constructor = ExitStatus;

var calledMain = false;

dependenciesFulfilled = function runCaller() {
 if (!Module["calledRun"]) run();
 if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};

Module["callMain"] = function callMain(args) {
 assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
 assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
 args = args || [];
 ensureInitRuntime();
 var argc = args.length + 1;
 var argv = stackAlloc((argc + 1) * 4);
 HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
 for (var i = 1; i < argc; i++) {
  HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
 }
 HEAP32[(argv >> 2) + argc] = 0;
 try {
  var ret = Module["_main"](argc, argv, 0);
  exit(ret, true);
 } catch (e) {
  if (e instanceof ExitStatus) {
   return;
  } else if (e == "SimulateInfiniteLoop") {
   Module["noExitRuntime"] = true;
   return;
  } else {
   var toLog = e;
   if (e && typeof e === "object" && e.stack) {
    toLog = [ e, e.stack ];
   }
   err("exception thrown: " + toLog);
   Module["quit"](1, e);
  }
 } finally {
  calledMain = true;
 }
};

function run(args) {
 args = args || Module["arguments"];
 if (runDependencies > 0) {
  return;
 }
 writeStackCookie();
 preRun();
 if (runDependencies > 0) return;
 if (Module["calledRun"]) return;
 function doRun() {
  if (Module["calledRun"]) return;
  Module["calledRun"] = true;
  if (ABORT) return;
  ensureInitRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  if (Module["_main"] && shouldRunNow) Module["callMain"](args);
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout(function() {
   setTimeout(function() {
    Module["setStatus"]("");
   }, 1);
   doRun();
  }, 1);
 } else {
  doRun();
 }
 checkStackCookie();
}

Module["run"] = run;

function checkUnflushedContent() {
 var print = out;
 var printErr = err;
 var has = false;
 out = err = function(x) {
  has = true;
 };
 try {
  var flush = Module["_fflush"];
  if (flush) flush(0);
  [ "stdout", "stderr" ].forEach(function(name) {
   var info = FS.analyzePath("/dev/" + name);
   if (!info) return;
   var stream = info.object;
   var rdev = stream.rdev;
   var tty = TTY.ttys[rdev];
   if (tty && tty.output && tty.output.length) {
    has = true;
   }
  });
 } catch (e) {}
 out = print;
 err = printErr;
 if (has) {
  warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.");
 }
}

function exit(status, implicit) {
 checkUnflushedContent();
 if (implicit && Module["noExitRuntime"] && status === 0) {
  return;
 }
 if (Module["noExitRuntime"]) {
  if (!implicit) {
   err("exit(" + status + ") called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)");
  }
 } else {
  ABORT = true;
  EXITSTATUS = status;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 Module["quit"](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 if (what !== undefined) {
  out(what);
  err(what);
  what = JSON.stringify(what);
 } else {
  what = "";
 }
 ABORT = true;
 EXITSTATUS = 1;
 var extra = "";
 var output = "abort(" + what + ") at " + stackTrace() + extra;
 if (abortDecorators) {
  abortDecorators.forEach(function(decorator) {
   output = decorator(output, what);
  });
 }
 throw output;
}

Module["abort"] = abort;

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

var shouldRunNow = true;

if (Module["noInitialRun"]) {
 shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();
