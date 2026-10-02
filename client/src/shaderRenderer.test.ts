import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startShader } from './shaderRenderer';

/** Just enough of a WebGL2 context to run startShader, recording what it releases. */
function fakeGl({ compiles = true } = {}) {
  const loseContext = vi.fn();
  let nextShader = 0;
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, TRIANGLES: 5,
    createShader: vi.fn(() => ({ id: `shader-${++nextShader}` })),
    shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => compiles), getShaderInfoLog: vi.fn(() => 'bad shader'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({ id: 'program' })),
    attachShader: vi.fn(), linkProgram: vi.fn(), getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(), deleteProgram: vi.fn(), useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})), viewport: vi.fn(), uniform3f: vi.fn(), uniform1f: vi.fn(),
    drawArrays: vi.fn(),
    getExtension: vi.fn((name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null)),
  };
  return { gl, loseContext };
}

function fakeCanvas(gl: unknown) {
  return { clientWidth: 200, clientHeight: 100, width: 0, height: 0, getContext: vi.fn(() => gl) } as unknown as HTMLCanvasElement;
}

const disconnect = vi.fn();
beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() { disconnect(); } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 7));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startShader', () => {
  it('draws, and stopping releases the program, both shaders and the context itself', () => {
    const { gl, loseContext } = fakeGl();
    const stop = startShader(fakeCanvas(gl));
    expect(gl.drawArrays).toHaveBeenCalled();
    expect(loseContext).not.toHaveBeenCalled();

    stop();

    expect(gl.deleteProgram).toHaveBeenCalledWith({ id: 'program' });
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(disconnect).toHaveBeenCalled();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('still releases the context when the shader fails to compile', () => {
    const { gl, loseContext } = fakeGl({ compiles: false });
    const stop = startShader(fakeCanvas(gl));

    expect(gl.drawArrays).not.toHaveBeenCalled();
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(() => stop()).not.toThrow();
  });

  it('does nothing where WebGL2 is unavailable', () => {
    const stop = startShader(fakeCanvas(null));
    expect(() => stop()).not.toThrow();
  });
});
