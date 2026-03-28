import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlanView } from '../components/plan/PlanView';
import type { PlanData } from '../hooks/usePlan';

// 2026-04-07 is a Tuesday.
// Week 1 existing days: Tue 2026-04-07 (run) + Wed 2026-04-08 (rest).
// Free slots in Week 1: Mon 2026-04-06, Thu 2026-04-09, Fri 2026-04-10, Sat, Sun.
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
          startDate: '2026-04-07',
          days: [
            { date: '2026-04-07', type: 'run', guidelines: 'Easy 5k', completed: false, skipped: false },
            { date: '2026-04-08', type: 'rest', guidelines: '', completed: false, skipped: false },
          ],
        },
        {
          weekNumber: 2,
          startDate: '2026-04-14',
          days: [
            { date: '2026-04-14', type: 'run', guidelines: 'Tempo run', completed: false, skipped: false },
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
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Base Phase')).toBeInTheDocument();
    expect(screen.getByText('Peak Phase')).toBeInTheDocument();
  });

  it('renders phase description when present', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Build your aerobic base')).toBeInTheDocument();
  });

  it('renders week headings', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
  });

  it('renders run days but hides rest days', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Easy 5k')).toBeInTheDocument();
    expect(screen.getByText('Tempo run')).toBeInTheDocument();
    // Rest days are filtered out
    expect(screen.queryByText('Rest')).not.toBeInTheDocument();
  });

  it('sorts days within a week by date', () => {
    const outOfOrderPlan: PlanData = {
      ...plan,
      phases: [
        {
          name: 'Phase',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              startDate: '2026-04-07',
              days: [
                { date: '2026-04-09', type: 'run', guidelines: 'Thursday run', completed: false, skipped: false },
                { date: '2026-04-07', type: 'run', guidelines: 'Tuesday run', completed: false, skipped: false },
              ],
            },
          ],
        },
      ],
    };
    render(<PlanView plan={outOfOrderPlan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    const items = screen.getAllByText(/run$/);
    // Tuesday run (2026-04-07) should appear before Thursday run (2026-04-09)
    const texts = items.map(el => el.textContent);
    expect(texts.indexOf('Tuesday run')).toBeLessThan(texts.indexOf('Thursday run'));
  });

  it('shows + Add day button per week when onAddDay is provided', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    // Two weeks in Base Phase + one empty week in Peak Phase = 2 weeks total (Peak has no weeks)
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('does not show + Add day button without onAddDay prop', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.queryByTitle('Add a day to this week')).not.toBeInTheDocument();
  });

  it('clicking + Add day opens inline form with weekday buttons', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    fireEvent.click(addButtons[0]);
    // Should show Mon-Sun weekday buttons
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('distance/time')).toBeInTheDocument();
  });

  it('weekday buttons: only run/cross-train days are disabled, rest days are available', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // Week 1 has 2026-04-07 (Tue, run — disabled) and 2026-04-08 (Wed, rest — NOT disabled)
    const tueBtns = screen.getAllByText('Tue');
    expect(tueBtns[0]).toBeDisabled();
    // Rest day on Wed should NOT be disabled — user can overwrite a rest day with a run
    const wedBtns = screen.getAllByText('Wed');
    expect(wedBtns[0]).not.toBeDisabled();
    // Mon, Thu, Fri, Sat, Sun are also free
    expect(screen.getAllByText('Mon')[0]).not.toBeDisabled();
    expect(screen.getAllByText('Thu')[0]).not.toBeDisabled();
  });

  it('saving add day form calls onAddDay with correct args', async () => {
    const onAddDay = vi.fn().mockResolvedValue(undefined);
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    const addButtons = screen.getAllByTitle('Add a day to this week');
    fireEvent.click(addButtons[0]); // Week 1 of Base Phase (startDate 2026-04-07, Tuesday)

    // Click Thu — maps to 2026-04-09 (Mon 2026-04-06 + 3 days)
    const thuBtns = screen.getAllByText('Thu');
    fireEvent.click(thuBtns[0]);

    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '8' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });

    expect(onAddDay).toHaveBeenCalledWith('Base Phase', 1, expect.objectContaining({
      date: '2026-04-09',
      type: 'run',
    }));
  });

  it('Add button is disabled until a weekday is selected', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('Add button remains disabled when a day is selected but no objective value', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // Select Thursday — a free slot in week 1
    fireEvent.click(screen.getAllByText('Thu')[0]);
    // No objective filled in → still disabled
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('Add button becomes enabled only after both day and objective value are filled', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    fireEvent.click(screen.getAllByText('Thu')[0]);
    // Still disabled with no value
    expect(screen.getByText('Add')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '5' } });
    // Now enabled
    expect(screen.getByText('Add')).not.toBeDisabled();
  });

  it('Add button is disabled when objective value is zero or non-numeric', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    fireEvent.click(screen.getAllByText('Thu')[0]);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '0' } });
    expect(screen.getByText('Add')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: 'abc' } });
    expect(screen.getByText('Add')).toBeDisabled();
  });

  it('saving add day form always includes objective fields', async () => {
    const onAddDay = vi.fn().mockResolvedValue(undefined);
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    fireEvent.click(screen.getAllByText('Thu')[0]);
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
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    const addBtn = screen.getAllByTitle('Add a day to this week')[0];
    expect(addBtn.className).toContain('cursor-pointer');
  });

  it('Add and Cancel buttons in AddDayForm have cursor-pointer', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    expect(screen.getByText('Add').className).toContain('cursor-pointer');
    expect(screen.getByText('Cancel').className).toContain('cursor-pointer');
  });

  it('available weekday buttons in AddDayForm have cursor-pointer', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    // Mon is a free slot in week 1
    expect(screen.getAllByText('Mon')[0].className).toContain('cursor-pointer');
    // Tue is taken — should NOT have cursor-pointer (has cursor-not-allowed instead)
    expect(screen.getAllByText('Tue')[0].className).not.toContain('cursor-pointer');
  });

  it('does not show + Add day button in readonly mode', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={vi.fn()} readonly={true} />);
    expect(screen.queryByTitle('Add a day to this week')).not.toBeInTheDocument();
  });

  it('Add button shows spinner and "Adding…" text while save is in flight', async () => {
    let resolveAdd!: () => void;
    const onAddDay = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; })
    );
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} onAddDay={onAddDay} />);
    fireEvent.click(screen.getAllByTitle('Add a day to this week')[0]);
    fireEvent.click(screen.getAllByText('Thu')[0]);
    fireEvent.change(screen.getByPlaceholderText('distance/time'), { target: { value: '5' } });

    fireEvent.click(screen.getByText('Add'));

    expect(await screen.findByText('Adding…')).toBeInTheDocument();
    expect(screen.getByText('Adding…')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();

    await act(async () => { resolveAdd(); });

    expect(screen.queryByText('Adding…')).not.toBeInTheDocument();
  });
});
