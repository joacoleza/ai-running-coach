import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlanView } from '../components/plan/PlanView';
import type { PlanData } from '../hooks/usePlan';

// Week 1: Day A (run), plus rest days (no label)
// Week 2: Day A (run)
const plan: PlanData = {
  _id: 'p1',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 0,
  goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
  phases: [
    {
      name: 'Base Phase',
      description: 'Build your aerobic base',
      weeks: [
        {
          weekNumber: 1,
          days: [
            { label: 'A', type: 'run', guidelines: 'Easy 5k', completed: false, skipped: false },
            { label: '', type: 'rest', guidelines: '', completed: false, skipped: false },
          ],
        },
        {
          weekNumber: 2,
          days: [
            { label: 'A', type: 'run', guidelines: 'Tempo run', completed: false, skipped: false },
          ],
        },
      ],
    },
    {
      name: 'Peak Phase',
      description: '',
      weeks: [],
    },
  ],
};

describe('PlanView', () => {
  it('renders all phase names', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Base Phase')).toBeInTheDocument();
    expect(screen.getByText('Peak Phase')).toBeInTheDocument();
  });

  it('renders phase description when present', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Build your aerobic base')).toBeInTheDocument();
  });

  it('renders week headings', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
  });

  it('renders run days but hides rest days', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Easy 5k')).toBeInTheDocument();
    expect(screen.getByText('Tempo run')).toBeInTheDocument();
    // Rest days are filtered out
    expect(screen.queryByText('Rest')).not.toBeInTheDocument();
  });

  it('sorts days within a week by label alphabetically', () => {
    const outOfOrderPlan: PlanData = {
      ...plan,
      phases: [
        {
          name: 'Phase',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              days: [
                { label: 'B', type: 'run', guidelines: 'Thursday run', completed: false, skipped: false },
                { label: 'A', type: 'run', guidelines: 'Tuesday run', completed: false, skipped: false },
              ],
            },
          ],
        },
      ],
    };
    render(<PlanView plan={outOfOrderPlan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    const items = screen.getAllByText(/run$/);
    // Tuesday run (label A) should appear before Thursday run (label B)
    const texts = items.map(el => el.textContent);
    expect(texts.indexOf('Tuesday run')).toBeLessThan(texts.indexOf('Thursday run'));
  });

  it('shows + Add day button per week when onAddDay is provided', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    // Two weeks in Base Phase (both have available label slots)
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('does not show + Add day button without onAddDay prop', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.queryByTitle('Add a day to this week')).not.toBeInTheDocument();
  });

  it('clicking + Add day opens inline form with label buttons A-G', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    fireEvent.click(addButtons[0]);
    // Should show A through G label buttons
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('distance/time')).toBeInTheDocument();
  });

  it('label buttons: only labels taken by non-rest days are disabled', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // Week 1 has label 'A' taken by a run day — A button should be disabled
    const aBtns = screen.getAllByText('A');
    // Find the one that's a button (inside the add form)
    const aBtn = aBtns.find(el => el.tagName === 'BUTTON');
    expect(aBtn).toBeDisabled();
    // Label B is free — should be enabled
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON');
    expect(bBtn).not.toBeDisabled();
  });

  it('saving add day form calls onAddDay with correct args', async () => {
    const onAddDay = vi.fn().mockResolvedValue(undefined);
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    fireEvent.click(addButtons[0]); // Week 1 of Base Phase

    // Click label B (free slot)
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);

    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '8' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });

    expect(onAddDay).toHaveBeenCalledWith('Base Phase', 1, expect.objectContaining({
      label: 'B',
      type: 'run',
    }));
  });

  it('Add button is disabled until a label is selected', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('Add button remains disabled when a label is selected but no objective value', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // Select label B — a free slot in week 1
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    // No objective filled in → still disabled
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('Add button becomes enabled only after both label and objective value are filled', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    // Still disabled with no value
    expect(screen.getByText('Add')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '5' } });
    // Now enabled
    expect(screen.getByText('Add')).not.toBeDisabled();
  });

  it('Add button is disabled when objective value is zero or non-numeric', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '0' } });
    expect(screen.getByText('Add')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: 'abc' } });
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('saving add day form always includes objective fields', async () => {
    const onAddDay = vi.fn().mockResolvedValue(undefined);
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '8' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });
    expect(onAddDay).toHaveBeenCalledWith('Base Phase', 1, expect.objectContaining({
      objective_kind: 'distance',
      objective_value: '8',
      objective_unit: 'km',
    }));
  });

  it('+ Add day button has cursor-pointer', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addBtn = screen.getAllByTitle('Add a day to this week')[0];
    expect(addBtn.className).toContain('cursor-pointer');
  });

  it('Add and Cancel buttons in AddDayForm have cursor-pointer', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    expect(screen.getByText('Add').className).toContain('cursor-pointer');
    expect(screen.getByText('Cancel').className).toContain('cursor-pointer');
  });

  it('available label buttons in AddDayForm have cursor-pointer', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // B is a free slot — should have cursor-pointer
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    expect(bBtn.className).toContain('cursor-pointer');
    // A is taken — should NOT have cursor-pointer (has cursor-not-allowed instead)
    const aBtns = screen.getAllByText('A');
    const aBtn = aBtns.find(el => el.tagName === 'BUTTON')!;
    expect(aBtn.className).not.toContain('cursor-pointer');
  });

  it('does not show + Add day button in readonly mode', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} readonly={true} />);
    expect(screen.queryByTitle('Add a day to this week')).not.toBeInTheDocument();
  });

  it('renders PhaseHeader with editable title when onUpdatePhase is provided', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onUpdatePhase={vi.fn()} />);
    // Phase names should appear and have hover edit styling
    const titleEl = screen.getByText('Base Phase');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.tagName).toBe('H2');
    expect(titleEl.className).toContain('cursor-pointer');
  });

  it('shows delete button only on last phase when multiple phases exist', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onUpdatePhase={vi.fn()} onDeletePhase={vi.fn()} />);
    // plan has 2 phases: Base Phase (idx 0) and Peak Phase (idx 1, last)
    // Delete phase button should only appear for the last phase
    const deleteButtons = screen.queryAllByTitle('Delete last phase');
    expect(deleteButtons).toHaveLength(1);
  });

  it('does not show delete button in readonly mode', () => {
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onUpdatePhase={vi.fn()} onDeletePhase={vi.fn()} readonly={true} />);
    expect(screen.queryByTitle('Delete last phase')).not.toBeInTheDocument();
  });

  it('shows + Add day button when week has fewer than 7 non-rest days', () => {
    // A plan with a week that has only 1 run day (labels A-F still available)
    const planWithSpace: PlanData = {
      ...plan,
      phases: [
        {
          name: 'Phase',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              days: [
                { label: 'A', type: 'run', guidelines: 'Only run', completed: true, skipped: false },
              ],
            },
          ],
        },
      ],
    };
    render(<PlanView plan={planWithSpace} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    expect(screen.queryByTitle('Add a day to this week')).toBeInTheDocument();
  });

  it('shows inline error message when onAddDay rejects', async () => {
    const onAddDay = vi.fn().mockRejectedValue(new Error('Day C already exists in week 1'));
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '5' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });

    expect(screen.getByText('Day C already exists in week 1')).toBeInTheDocument();
  });

  it('Add button shows spinner and "Adding…" text while save is in flight', async () => {
    let resolveAdd!: () => void;
    const onAddDay = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; })
    );
    render(<PlanView plan={plan} linkedRuns={new Map()} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    const bBtns = screen.getAllByText('B');
    const bBtn = bBtns.find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bBtn);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '5' } });

    fireEvent.click(screen.getByText('Add'));

    expect(await screen.findByText('Adding…')).toBeInTheDocument();
    expect(screen.getByText('Adding…')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();

    await act(async () => { resolveAdd(); });

    expect(screen.queryByText('Adding…')).not.toBeInTheDocument();
  });
});
