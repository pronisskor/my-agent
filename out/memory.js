"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Memory {
    constructor(workspaceRoot) {
        this.memoryDir = path.join(workspaceRoot, "memory");
        this.skillsDir = path.join(workspaceRoot, "skills"); // ← 워크스페이스 기준
        this.init();
    }
    init() {
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
        if (!fs.existsSync(this.skillsDir)) {
            console.error("Skills directory not found at: " + this.skillsDir);
        }
    }
    read(filename) {
        const filePath = path.join(this.memoryDir, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, "utf-8");
        }
        return "";
    }
    write(filename, content) {
        const filePath = path.join(this.memoryDir, filename);
        fs.writeFileSync(filePath, content, "utf-8");
    }
    append(filename, content) {
        const filePath = path.join(this.memoryDir, filename);
        fs.appendFileSync(filePath, "\n" + content, "utf-8");
    }
    delete(filename) {
        const filePath = path.join(this.memoryDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    readSkill(filename) {
        const filePath = path.join(this.skillsDir, filename);
        console.log("Reading skill from: " + filePath); // ← 디버그
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, "utf-8");
        }
        console.error("Skill file not found: " + filePath); // ← 디버그
        return "";
    }
}
exports.Memory = Memory;
