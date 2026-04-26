import * as fs from "fs";
import * as path from "path";

export class Memory {
  private memoryDir: string;
  private skillsDir: string;

  constructor(workspaceRoot: string, extensionRoot: string) {
    this.memoryDir = path.join(workspaceRoot, "memory");
    this.skillsDir = path.join(extensionRoot, "skills");
    this.init();
  }

  private init() {
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
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "";
  }
}
