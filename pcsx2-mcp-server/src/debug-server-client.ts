/**
 * PCSX2 Debug Server Client
 * Talks to the custom C++ JSON/TCP server inside PCSX2 (port 21512)
 *
 * Protocol: newline-delimited JSON over TCP
 * Request:  {"cmd":"...", ...}\n
 * Response: {"ok":true, ...}\n
 */

import * as net from 'node:net';

export interface DebugRegister {
  name: string;
  value: string;
  display: string;
}

export interface RegisterCategory {
  size: number;
  count: number;
  regs: DebugRegister[];
}

export interface DisasmInstruction {
  address: string;
  opcode: string;
  disasm: string;
}

export interface BreakpointInfo {
  address: string;
  enabled: boolean;
  temporary: boolean;
  stepping: boolean;
  has_condition: boolean;
  condition?: string;
  description?: string;
}

export interface MemcheckInfo {
  start: string;
  end: string;
  hits: number;
  last_pc: string;
  last_addr: string;
  description?: string;
}

export interface ThreadInfo {
  id: number;
  pc: string;
  status: number;
  wait_type: number;
}

export interface StepResult {
  old_pc: string;
  new_pc: string;
  disasm: string;
  opcode: string;
}

export interface EvalResult {
  ok: boolean;
  result?: number;
  hex?: string;
  error?: string;
}

export interface ControllerState {
  /** Digital buttons bitfield (PS2 pad style). See docs in tool description. */
  buttons?: number;
  /** Analog sticks 0-255, center ~128 */
  lx?: number;
  ly?: number;
  rx?: number;
  ry?: number;
  /** Pressure 0-255 for dualshock buttons (optional) */
  pressure?: Record<string, number>;
  /** Port 0 or 1 */
  port?: number;
  /** Slot 0 or 1 */
  slot?: number;
}

export interface ScreenshotResult {
  ok: boolean;
  width?: number;
  height?: number;
  format?: string;
  /** base64-encoded image data (png or raw) */
  data?: string;
  error?: string;
  note?: string;
}

type CpuTarget = 'ee' | 'iop';

export class DebugServerClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private connected = false;
  private responseBuffer = '';
  private pendingResolve: ((data: any) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;

  constructor(host = '127.0.0.1', port = 21512) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setEncoding('utf8');

      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout to DebugServer at ${this.host}:${this.port}`));
      }, 3000);

      this.socket.connect(this.port, this.host, () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.socket.on('data', (data: string) => {
        this.responseBuffer += data;
        this.processBuffer();
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeout);
        this.connected = false;
        if (this.pendingReject) {
          this.pendingReject(err);
          this.pendingResolve = null;
          this.pendingReject = null;
        } else {
          reject(err);
        }
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  private processBuffer(): void {
    const newlineIdx = this.responseBuffer.indexOf('\n');
    if (newlineIdx < 0) return;

    const line = this.responseBuffer.substring(0, newlineIdx);
    this.responseBuffer = this.responseBuffer.substring(newlineIdx + 1);

    if (this.pendingResolve) {
      try {
        const data = JSON.parse(line);
        this.pendingResolve(data);
      } catch (e) {
        if (this.pendingReject) this.pendingReject(new Error(`Invalid JSON: ${line}`));
      }
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }

  private async send(cmd: Record<string, any>): Promise<any> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to PCSX2 Debug Server');
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const json = JSON.stringify(cmd) + '\n';
      this.socket!.write(json);

      setTimeout(() => {
        if (this.pendingReject === reject) {
          this.pendingResolve = null;
          this.pendingReject = null;
          reject(new Error(`Command timeout: ${cmd.cmd}`));
        }
      }, 10000);
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  async getStatus(cpu: CpuTarget = 'ee'): Promise<{ alive: boolean; paused: boolean; pc: string; cycles: number }> {
    const resp = await this.send({ cmd: 'status', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.data;
  }

  async readRegisters(cpu: CpuTarget = 'ee', category?: number): Promise<any> {
    const cmd: any = { cmd: 'read_registers', cpu };
    if (category !== undefined) cmd.category = category;
    const resp = await this.send(cmd);
    if (!resp.ok) throw new Error(resp.error);
    return resp.data;
  }

  async writeRegister(category: number, index: number, value: string, cpu: CpuTarget = 'ee'): Promise<void> {
    const resp = await this.send({ cmd: 'write_register', cpu, category, index, value });
    if (!resp.ok) throw new Error(resp.error);
  }

  async setPC(value: string, cpu: CpuTarget = 'ee'): Promise<void> {
    const resp = await this.send({ cmd: 'set_pc', cpu, value });
    if (!resp.ok) throw new Error(resp.error);
  }

  async readMemory(address: string, length: number, cpu: CpuTarget = 'ee'): Promise<string> {
    const resp = await this.send({ cmd: 'read_memory', cpu, address, length });
    if (!resp.ok) throw new Error(resp.error);
    return resp.hex;
  }

  async readMemoryBuffer(address: string, length: number, cpu: CpuTarget = 'ee'): Promise<Buffer> {
    const hex = await this.readMemory(address, length, cpu);
    return Buffer.from(hex, 'hex');
  }

  async writeMemory(address: string, data: string, cpu: CpuTarget = 'ee'): Promise<number> {
    const resp = await this.send({ cmd: 'write_memory', cpu, address, data });
    if (!resp.ok) throw new Error(resp.error);
    return resp.written;
  }

  async readString(address: string, maxLength = 256, cpu: CpuTarget = 'ee'): Promise<string> {
    const resp = await this.send({ cmd: 'read_string', cpu, address, max_length: maxLength });
    if (!resp.ok) throw new Error(resp.error);
    return resp.string;
  }

  async isValidAddress(address: string, cpu: CpuTarget = 'ee'): Promise<boolean> {
    const resp = await this.send({ cmd: 'is_valid_address', cpu, address });
    if (!resp.ok) throw new Error(resp.error);
    return resp.valid;
  }

  async disassemble(address: string, count = 20, simplify = true, cpu: CpuTarget = 'ee'): Promise<DisasmInstruction[]> {
    const resp = await this.send({ cmd: 'disassemble', cpu, address, count, simplify });
    if (!resp.ok) throw new Error(resp.error);
    return resp.instructions;
  }

  async evaluate(expression: string, cpu: CpuTarget = 'ee'): Promise<EvalResult> {
    const resp = await this.send({ cmd: 'evaluate', cpu, expression });
    return resp;
  }

  async setBreakpoint(address: string, options?: { condition?: string; description?: string; temporary?: boolean; cpu?: CpuTarget }): Promise<void> {
    const resp = await this.send({
      cmd: 'set_breakpoint',
      cpu: options?.cpu || 'ee',
      address,
      condition: options?.condition,
      description: options?.description,
      temporary: options?.temporary ?? false,
    });
    if (!resp.ok) throw new Error(resp.error);
  }

  async removeBreakpoint(address: string, cpu: CpuTarget = 'ee'): Promise<void> {
    const resp = await this.send({ cmd: 'remove_breakpoint', cpu, address });
    if (!resp.ok) throw new Error(resp.error);
  }

  async listBreakpoints(cpu: CpuTarget = 'ee'): Promise<BreakpointInfo[]> {
    const resp = await this.send({ cmd: 'list_breakpoints', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.breakpoints;
  }

  async setMemcheck(address: string, end: string, options?: {
    type?: 'read' | 'write' | 'readwrite' | 'onchange';
    action?: 'break' | 'log' | 'both';
    condition?: string;
    description?: string;
    cpu?: CpuTarget;
  }): Promise<void> {
    const resp = await this.send({
      cmd: 'set_memcheck',
      cpu: options?.cpu || 'ee',
      address,
      end,
      type: options?.type || 'write',
      action: options?.action || 'break',
      condition: options?.condition,
      description: options?.description,
    });
    if (!resp.ok) throw new Error(resp.error);
  }

  async removeMemcheck(address: string, end: string, cpu: CpuTarget = 'ee'): Promise<void> {
    const resp = await this.send({ cmd: 'remove_memcheck', cpu, address, end });
    if (!resp.ok) throw new Error(resp.error);
  }

  async listMemchecks(cpu: CpuTarget = 'ee'): Promise<MemcheckInfo[]> {
    const resp = await this.send({ cmd: 'list_memchecks', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.memchecks;
  }

  async pause(cpu: CpuTarget = 'ee'): Promise<string> {
    const resp = await this.send({ cmd: 'pause', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.pc;
  }

  async resume(cpu: CpuTarget = 'ee'): Promise<void> {
    const resp = await this.send({ cmd: 'resume', cpu });
    if (!resp.ok) throw new Error(resp.error);
  }

  async step(cpu: CpuTarget = 'ee'): Promise<StepResult> {
    const resp = await this.send({ cmd: 'step', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp;
  }

  async stepOver(cpu: CpuTarget = 'ee'): Promise<StepResult> {
    const resp = await this.send({ cmd: 'step_over', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp;
  }

  async getThreads(cpu: CpuTarget = 'ee'): Promise<ThreadInfo[]> {
    const resp = await this.send({ cmd: 'get_threads', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.threads;
  }

  async getModules(cpu: CpuTarget = 'iop'): Promise<Array<{ name: string; version: number }>> {
    const resp = await this.send({ cmd: 'get_modules', cpu });
    if (!resp.ok) throw new Error(resp.error);
    return resp.modules;
  }

  async getBacktrace(cpu: CpuTarget = 'ee', maxFrames = 32): Promise<Array<{ entry: string; pc: string; sp: string; stack_size: number; disasm: string }>> {
    const resp = await this.send({ cmd: 'get_backtrace', cpu, max_frames: maxFrames });
    if (!resp.ok) throw new Error(resp.error);
    return resp.frames;
  }

  async clearAllBreakpoints(): Promise<void> {
    const resp = await this.send({ cmd: 'clear_breakpoints' });
    if (!resp.ok) throw new Error(resp.error);
  }

  // ===== NEW: Controller Input =====

  /**
   * Inject dualshock / digital pad state into PCSX2.
   * Requires DebugServer support for cmd "send_controller".
   * Until C++ pad hook is compiled in, server returns a structured "not implemented" note.
   */
  async sendController(state: ControllerState): Promise<{ ok: boolean; message?: string; error?: string }> {
    const resp = await this.send({
      cmd: 'send_controller',
      port: state.port ?? 0,
      slot: state.slot ?? 0,
      buttons: state.buttons ?? 0xffff,
      lx: state.lx ?? 128,
      ly: state.ly ?? 128,
      rx: state.rx ?? 128,
      ry: state.ry ?? 128,
      pressure: state.pressure ?? {},
    });
    return resp;
  }

  // ===== NEW: Screenshot / Frame Capture =====

  /**
   * Request a framebuffer screenshot from the GS (or host window).
   * Returns base64 PNG when fully implemented in DebugServer.
   */
  async getScreenshot(options?: { max_width?: number; format?: 'png' | 'raw' }): Promise<ScreenshotResult> {
    const resp = await this.send({
      cmd: 'get_screenshot',
      max_width: options?.max_width ?? 640,
      format: options?.format ?? 'png',
    });
    return resp as ScreenshotResult;
  }
}
