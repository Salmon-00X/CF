import { renderHook, act } from '@testing-library/react';
import { useFilters } from './useFilters';

test('update merges a patch without dropping other keys', () => {
  const { result } = renderHook(() => useFilters());
  act(() => result.current.update({ model: 'Raptor' }));
  expect(result.current.filters.model).toBe('Raptor');
  expect(result.current.filters.periodPreset).toBe('single'); // untouched
});

test('reset restores the default filter values', () => {
  const { result } = renderHook(() => useFilters());
  act(() => result.current.update({ model: 'Raptor', chartType: 'pareto' }));
  act(() => result.current.reset());
  expect(result.current.filters.model).toBe('Both');
  expect(result.current.filters.chartType).toBe('box');
});
