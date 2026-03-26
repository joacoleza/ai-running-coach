import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatMessage } from '../components/coach/ChatMessage'

describe('ChatMessage', () => {
  it('renders user message as plain text without markdown processing', () => {
    render(<ChatMessage role="user" content="**bold** and _italic_" />)
    // Should show raw text, not rendered HTML
    expect(screen.getByText('**bold** and _italic_')).toBeInTheDocument()
    expect(screen.queryByRole('strong')).not.toBeInTheDocument()
  })

  it('renders assistant message bold text as <strong>', () => {
    render(<ChatMessage role="assistant" content="**Important note**" />)
    expect(screen.getByText('Important note')).toBeInTheDocument()
    const strong = screen.getByText('Important note').closest('strong') ?? screen.getByText('Important note').parentElement
    expect(strong?.tagName.toLowerCase()).toMatch(/strong|b/)
  })

  it('renders assistant message bullet list as <ul>', () => {
    render(<ChatMessage role="assistant" content={"- Item one\n- Item two\n- Item three"} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('Item two')).toBeInTheDocument()
    expect(screen.getByText('Item three')).toBeInTheDocument()
  })

  it('renders assistant message with heading', () => {
    render(<ChatMessage role="assistant" content={"## Week 1\nEasy runs only."} />)
    expect(screen.getByRole('heading', { name: 'Week 1' })).toBeInTheDocument()
    expect(screen.getByText('Easy runs only.')).toBeInTheDocument()
  })

  it('renders assistant message inline code', () => {
    render(<ChatMessage role="assistant" content="Run at `6:00/km` pace" />)
    expect(screen.getByText('6:00/km')).toBeInTheDocument()
  })

  it('renders multi-paragraph assistant message', () => {
    const content = "First paragraph.\n\nSecond paragraph."
    render(<ChatMessage role="assistant" content={content} />)
    expect(screen.getByText('First paragraph.')).toBeInTheDocument()
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument()
  })
})
