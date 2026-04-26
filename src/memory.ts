import * as fs from "fs";
import * as path from "path";

export class Memory {
  private memoryDir: string;
  private skillsDir: string;

  constructor(workspaceRoot: string) {
    this.memoryDir = path.join(workspaceRoot, "memory");
    this.skillsDir = path.join(workspaceRoot, "skills"); // ← 워크스페이스 기준
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!fs.existsSync(this.skillsDir)) {
      console.error("Skills directory not found at: " + this.skillsDir);
    }
  }

  read(filename: string): string {
    const filePath = path.join(this.memoryDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "";
  }

  write(filename: string, content: string) {
    const filePath = path.join(this.memoryDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
  }

  append(filename: string, content: string) {
    const filePath = path.join(this.memoryDir, filename);
    fs.appendFileSync(filePath, "\n" + content, "utf-8");
  }

  delete(filename: string) {
    const filePath = path.join(this.memoryDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  readSkill(filename: string): string {
    const filePath = path.join(this.skillsDir, filename);
    console.log("Reading skill from: " + filePath); // ← 디버그
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    console.error("Skill file not found: " + filePath); // ← 디버그
    return "";
  }
}
