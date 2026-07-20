import { useEffect, useReducer } from 'react';
import type { LuaMessage } from '@shared/protocol/messages';
import {
  applyConnection,
  applyMessage,
  clearOverride,
  cycleManualStage,
  initialTrackerState,
  toggleManualClear,
  toggleOverride,
  type TrackerState
} from '@shared/tracker/store';

interface BridgeEvent {
  kind: 'connect' | 'disconnect' | 'message';
  message?: LuaMessage;
}

type Action =
  | { type: 'bridge'; event: BridgeEvent }
  | { type: 'toggle'; code: string }
  | { type: 'clear'; code: string }
  | { type: 'cycle'; code: string; stageCount: number; delta: number }
  | { type: 'toggleClear'; sectionKey: string }
  | { type: 'setFlags'; raw: string };

function reducer(state: TrackerState, action: Action): TrackerState {
  switch (action.type) {
    case 'bridge': {
      const { event } = action;
      if (event.kind === 'connect') return applyConnection(state, true);
      if (event.kind === 'disconnect') return applyConnection(state, false);
      return event.message ? applyMessage(state, event.message) : state;
    }
    case 'toggle':
      return toggleOverride(state, action.code);
    case 'clear':
      return clearOverride(state, action.code);
    case 'cycle':
      return cycleManualStage(state, action.code, action.stageCount, action.delta);
    case 'toggleClear':
      return toggleManualClear(state, action.sectionKey);
    case 'setFlags':
      return applyMessage(state, { t: 'flags', raw: action.raw });
  }
}

export interface TrackerApi {
  state: TrackerState;
  toggle(code: string): void;
  clear(code: string): void;
  cycle(code: string, stageCount: number, delta?: number): void;
  toggleClear(sectionKey: string): void;
  setFlags(raw: string): void;
}

export function useTracker(): TrackerApi {
  const [state, dispatch] = useReducer(reducer, undefined, initialTrackerState);

  useEffect(() => {
    return window.tracker.onBridgeEvent((raw) =>
      dispatch({ type: 'bridge', event: raw as BridgeEvent })
    );
  }, []);

  return {
    state,
    toggle: (code) => dispatch({ type: 'toggle', code }),
    clear: (code) => dispatch({ type: 'clear', code }),
    cycle: (code, stageCount, delta = 1) => dispatch({ type: 'cycle', code, stageCount, delta }),
    toggleClear: (sectionKey) => dispatch({ type: 'toggleClear', sectionKey }),
    setFlags: (raw) => dispatch({ type: 'setFlags', raw })
  };
}
