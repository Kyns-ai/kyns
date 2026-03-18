import { Constants } from '@librechat/agents';
import type {
  ToolExecuteBatchRequest,
  ToolExecuteResult,
  ToolCallRequest,
} from '@librechat/agents';
import { createToolExecuteHandler, ToolExecuteOptions } from './handlers';

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

function createMockTool(name: string, capturedConfigs: Record<string, unknown>[]) {
  return {
    name,
    invoke: jest.fn(async (_args: unknown, config: Record<string, unknown>) => {
      capturedConfigs.push({ ...(config.toolCall as Record<string, unknown>) });
      return {
        content: `stdout:\n${name} executed\n`,
        artifact: { session_id: `result-session-${name}`, files: [] },
      };
    }),
  };
}

function createHandler(
  capturedConfigs: Record<string, unknown>[],
  toolNames: string[] = [Constants.EXECUTE_CODE],
) {
  const mockTools = toolNames.map((name) => createMockTool(name, capturedConfigs));
  const loadTools: ToolExecuteOptions['loadTools'] = jest.fn(async () => ({
    loadedTools: mockTools as never[],
  }));
  return createToolExecuteHandler({ loadTools });
}

function createCustomHandler(
  tool: {
    name: string;
    invoke: (args: unknown, config: Record<string, unknown>) => Promise<unknown>;
  },
  toolEndCallback?: ToolExecuteOptions['toolEndCallback'],
) {
  const loadTools: ToolExecuteOptions['loadTools'] = jest.fn(async () => ({
    loadedTools: [tool] as never[],
  }));
  return createToolExecuteHandler({ loadTools, toolEndCallback });
}

function invokeHandler(
  handler: ReturnType<typeof createToolExecuteHandler>,
  toolCalls: ToolCallRequest[],
): Promise<ToolExecuteResult[]> {
  return new Promise((resolve, reject) => {
    const request: ToolExecuteBatchRequest = {
      toolCalls,
      resolve,
      reject,
    };
    handler.handle('on_tool_execute', request);
  });
}

describe('createToolExecuteHandler', () => {
  describe('tool result normalization', () => {
    it('normalizes string tool results into content-only output', async () => {
      const toolEndCallback = jest.fn(async () => {});
      const handler = createCustomHandler(
        {
          name: 'web_search',
          invoke: jest.fn(async () => 'plain string result'),
        },
        toolEndCallback,
      );

      const results = await invokeHandler(handler, [
        {
          id: 'call_string',
          name: 'web_search',
          args: { query: 'test' },
        },
      ]);

      expect(results).toEqual([
        {
          toolCallId: 'call_string',
          content: 'plain string result',
          artifact: undefined,
          status: 'success',
        },
      ]);
      expect(toolEndCallback).toHaveBeenCalledWith(
        {
          output: {
            name: 'web_search',
            tool_call_id: 'call_string',
            content: 'plain string result',
            artifact: undefined,
          },
        },
        expect.any(Object),
      );
    });

    it('normalizes tuple tool results into content and artifact', async () => {
      const artifact = { content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }] };
      const toolEndCallback = jest.fn(async () => {});
      const handler = createCustomHandler(
        {
          name: 'kyns-image-gen',
          invoke: jest.fn(async () => ['tool content', artifact]),
        },
        toolEndCallback,
      );

      const results = await invokeHandler(handler, [
        {
          id: 'call_tuple',
          name: 'kyns-image-gen',
          args: { prompt: 'test image' },
        },
      ]);

      expect(results).toEqual([
        {
          toolCallId: 'call_tuple',
          content: 'tool content',
          artifact,
          status: 'success',
        },
      ]);
      expect(toolEndCallback).toHaveBeenCalledWith(
        {
          output: {
            name: 'kyns-image-gen',
            tool_call_id: 'call_tuple',
            content: 'tool content',
            artifact,
          },
        },
        expect.any(Object),
      );
    });

    it('serializes raw object tool results into safe content', async () => {
      const toolEndCallback = jest.fn(async () => {});
      const handler = createCustomHandler(
        {
          name: 'web_search',
          invoke: jest.fn(async () => ({ answer: 'ok', sources: 3 })),
        },
        toolEndCallback,
      );

      const results = await invokeHandler(handler, [
        {
          id: 'call_object',
          name: 'web_search',
          args: { query: 'test' },
        },
      ]);

      expect(results).toEqual([
        {
          toolCallId: 'call_object',
          content: JSON.stringify({ answer: 'ok', sources: 3 }),
          artifact: undefined,
          status: 'success',
        },
      ]);
      expect(toolEndCallback).toHaveBeenCalledWith(
        {
          output: {
            name: 'web_search',
            tool_call_id: 'call_object',
            content: JSON.stringify({ answer: 'ok', sources: 3 }),
            artifact: undefined,
          },
        },
        expect.any(Object),
      );
    });
  });

  describe('code execution session context passthrough', () => {
    it('passes session_id and _injected_files from codeSessionContext to toolCallConfig', async () => {
      const capturedConfigs: Record<string, unknown>[] = [];
      const handler = createHandler(capturedConfigs);

      const toolCalls: ToolCallRequest[] = [
        {
          id: 'call_1',
          name: Constants.EXECUTE_CODE,
          args: { lang: 'python', code: 'print("hi")' },
          codeSessionContext: {
            session_id: 'prev-session-abc',
            files: [
              { session_id: 'prev-session-abc', id: 'f1', name: 'data.parquet' },
              { session_id: 'prev-session-abc', id: 'f2', name: 'chart.png' },
            ],
          },
        },
      ];

      await invokeHandler(handler, toolCalls);

      expect(capturedConfigs).toHaveLength(1);
      expect(capturedConfigs[0].session_id).toBe('prev-session-abc');
      expect(capturedConfigs[0]._injected_files).toEqual([
        { session_id: 'prev-session-abc', id: 'f1', name: 'data.parquet' },
        { session_id: 'prev-session-abc', id: 'f2', name: 'chart.png' },
      ]);
    });

    it('passes session_id without _injected_files when session has no files', async () => {
      const capturedConfigs: Record<string, unknown>[] = [];
      const handler = createHandler(capturedConfigs);

      const toolCalls: ToolCallRequest[] = [
        {
          id: 'call_2',
          name: Constants.EXECUTE_CODE,
          args: { lang: 'python', code: 'import pandas' },
          codeSessionContext: {
            session_id: 'session-no-files',
          },
        },
      ];

      await invokeHandler(handler, toolCalls);

      expect(capturedConfigs).toHaveLength(1);
      expect(capturedConfigs[0].session_id).toBe('session-no-files');
      expect(capturedConfigs[0]._injected_files).toBeUndefined();
    });

    it('does not inject session context when codeSessionContext is absent', async () => {
      const capturedConfigs: Record<string, unknown>[] = [];
      const handler = createHandler(capturedConfigs);

      const toolCalls: ToolCallRequest[] = [
        {
          id: 'call_3',
          name: Constants.EXECUTE_CODE,
          args: { lang: 'python', code: 'x = 1' },
        },
      ];

      await invokeHandler(handler, toolCalls);

      expect(capturedConfigs).toHaveLength(1);
      expect(capturedConfigs[0].session_id).toBeUndefined();
      expect(capturedConfigs[0]._injected_files).toBeUndefined();
    });

    it('passes session context independently for multiple code execution calls', async () => {
      const capturedConfigs: Record<string, unknown>[] = [];
      const handler = createHandler(capturedConfigs);

      const toolCalls: ToolCallRequest[] = [
        {
          id: 'call_a',
          name: Constants.EXECUTE_CODE,
          args: { lang: 'python', code: 'step_1()' },
          codeSessionContext: {
            session_id: 'session-A',
            files: [{ session_id: 'session-A', id: 'fa', name: 'a.csv' }],
          },
        },
        {
          id: 'call_b',
          name: Constants.EXECUTE_CODE,
          args: { lang: 'python', code: 'step_2()' },
          codeSessionContext: {
            session_id: 'session-A',
            files: [{ session_id: 'session-A', id: 'fa', name: 'a.csv' }],
          },
        },
      ];

      await invokeHandler(handler, toolCalls);

      expect(capturedConfigs).toHaveLength(2);
      for (const config of capturedConfigs) {
        expect(config.session_id).toBe('session-A');
        expect(config._injected_files).toEqual([
          { session_id: 'session-A', id: 'fa', name: 'a.csv' },
        ]);
      }
    });

    it('does not pass session context to non-code-execution tools', async () => {
      const capturedConfigs: Record<string, unknown>[] = [];
      const handler = createHandler(capturedConfigs, ['web_search']);

      const toolCalls: ToolCallRequest[] = [
        {
          id: 'call_ws',
          name: 'web_search',
          args: { query: 'test' },
          codeSessionContext: {
            session_id: 'should-be-ignored',
            files: [{ session_id: 'x', id: 'y', name: 'z' }],
          },
        },
      ];

      await invokeHandler(handler, toolCalls);

      expect(capturedConfigs).toHaveLength(1);
      expect(capturedConfigs[0].session_id).toBeUndefined();
      expect(capturedConfigs[0]._injected_files).toBeUndefined();
    });
  });
});
