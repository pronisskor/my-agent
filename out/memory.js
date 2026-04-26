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
    constructor(workspaceRoot, extensionRoot) {
        this.memoryDir = path.join(workspaceRoot, "memory");
        this.skillsDir = path.join(extensionRoot, "skills");
        this.init();
    }
    init() {
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
        // skillsDir는 확장에 포함된 것이므로 여기서 생성하지 않고 존재여부만 체크하는 것이 안전하지만,
        // 일단 기존 로직을 유지하되 확장 경로를 우선시합니다.
        if (!fs.existsSync(this.skillsDir)) {
            // 확장의 skills 폴더가 없는 경우에만 워크스페이스 아래를 시도하거나 에러를 냅니다.
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
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, "utf-8");
        }
        return "";
    }
}
exports.Memory = Memory;
