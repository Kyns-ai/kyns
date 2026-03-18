import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SmartLoader, useHasData } from '../SmartLoader';

// Mock setTimeout and clearTimeout for testing
jest.useFakeTimers();

describe('SmartLoader', () => {
  const LoadingComponent = () => <div data-testid="loading">Loading...</div>;
  const ContentComponent = () => (
    <div data-testid="content">
      {/* eslint-disable-line i18next/no-literal-string */}Content loaded
    </div>
  );

  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Basic functionality', () => {
    it('shows content immediately when not loading', () => {
      render(
        <SmartLoader isLoading={false} hasData={true} loadingComponent={<LoadingComponent />}>
          <ContentComponent />
        </SmartLoader>,
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('shows content immediately when loading but has existing data', () => {
      render(
        <SmartLoader isLoading={true} hasData={true} loadingComponent={<LoadingComponent />}>
          <ContentComponent />
        </SmartLoader>,
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('shows content initially, then loading after delay when loading with no data', async () => {
      render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={150}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Initially shows content
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();

      // After delay, shows loading
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
        expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      });
    });

    it('prevents loading flash for quick responses', async () => {
      const { rerender } = render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={150}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Initially shows content
      expect(screen.getByTestId('content')).toBeInTheDocument();

      // Advance time but not past delay
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Loading finishes before delay
      rerender(
        <SmartLoader
          isLoading={false}
          hasData={true}
          delay={150}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Should still show content, never showed loading
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();

      // Advance past original delay to ensure loading doesn't appear
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  describe('Delay behavior', () => {
    it('respects custom delay times', async () => {
      render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={300}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Should show content initially
      expect(screen.getByTestId('content')).toBeInTheDocument();

      // Should not show loading before delay
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();

      // Should show loading after delay
      act(() => {
        jest.advanceTimersByTime(60);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
      });
    });

    it('uses default delay when not specified', async () => {
      render(
        <SmartLoader isLoading={true} hasData={false} loadingComponent={<LoadingComponent />}>
          <ContentComponent />
        </SmartLoader>,
      );

      // Should show content initially
      expect(screen.getByTestId('content')).toBeInTheDocument();

      // Should show loading after default delay (150ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
      });
    });
  });

  describe('State transitions', () => {
    it('immediately hides loading when loading completes', async () => {
      const { rerender } = render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={100}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Advance past delay to show loading
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
      });

      // Loading completes
      rerender(
        <SmartLoader
          isLoading={false}
          hasData={true}
          delay={100}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Should immediately show content
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('handles rapid loading state changes correctly', async () => {
      const { rerender } = render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={100}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Rapid state changes
      rerender(
        <SmartLoader
          isLoading={false}
          hasData={true}
          delay={100}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      rerender(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={100}
          loadingComponent={<LoadingComponent />}
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Should show content throughout rapid changes
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('applies custom className', () => {
      const { container } = render(
        <SmartLoader
          isLoading={false}
          hasData={true}
          loadingComponent={<LoadingComponent />}
          className="custom-class"
        >
          <ContentComponent />
        </SmartLoader>,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('applies className to both loading and content states', async () => {
      const { container } = render(
        <SmartLoader
          isLoading={true}
          hasData={false}
          delay={50}
          loadingComponent={<LoadingComponent />}
          className="custom-class"
        >
          <ContentComponent />
        </SmartLoader>,
      );

      // Content state
      expect(container.firstChild).toHaveClass('custom-class');

      // Loading state
      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class');
      });
    });
  });
});

describe('useHasData', () => {
  const TestComponent: React.FC<{ data: any }> = ({ data }) => {
    const hasData = useHasData(data);
    return <div data-testid="result">{hasData ? 'has-data' : 'no-data'}</div>;
  };

  it('returns false for null data', () => {
    render(<TestComponent data={null} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('returns false for undefined data', () => {
    render(<TestComponent data={undefined} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('detects empty agent list payload as no data', () => {
    render(<TestComponent data={{ object: 'list', data: [], has_more: false }} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('detects non-empty agent list payload as has data', () => {
    render(
      <TestComponent
        data={{ object: 'list', data: [{ id: '1', name: 'Test' }], has_more: false }}
      />,
    );
    expect(screen.getByTestId('result')).toHaveTextContent('has-data');
  });

  it('detects null list data as no data', () => {
    render(<TestComponent data={{ object: 'list', data: null, has_more: false }} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('detects missing list data as no data', () => {
    render(<TestComponent data={{ object: 'list', has_more: false }} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('handles string data as no data', () => {
    render(<TestComponent data="some string" />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('handles number data as no data', () => {
    render(<TestComponent data={42} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });

  it('handles boolean data as no data', () => {
    render(<TestComponent data={true} />);
    expect(screen.getByTestId('result')).toHaveTextContent('no-data');
  });
});
