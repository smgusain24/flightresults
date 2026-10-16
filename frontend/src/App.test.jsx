import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { jsonResponse, mockFetch } from './test/mockFetch.js'

const SEARCH = 'POST /api/flight-listings'
const DATE = '2099-01-15'

// API order is departure order.
const FLIGHTS = [
  { start_time: '06:00', journey_time: '45m', price: 5200, stars: 3, set: 1 },
  { start_time: '09:15', journey_time: '1h 05m', price: 3100, stars: 4, set: 2 },
  { start_time: '18:30', journey_time: '50m', price: 7400, stars: 5, set: 3 },
]

// Mirrors the backend: applies `stars gte` filters from the request body.
const filteredFlights = (options) => {
  const { filters } = JSON.parse(options.body).data
  const minStars = filters.find((filter) => filter.field === 'stars')?.value ?? 0
  return jsonResponse(
    200,
    FLIGHTS.filter((flight) => flight.stars >= minStars),
  )
}

const searchBodies = (fetchMock) =>
  fetchMock.mock.calls
    .filter(([, options]) => options?.method === 'POST')
    .map(([, options]) => JSON.parse(options.body).data)

const heading = () => screen.getByRole('heading', { level: 2 })
const prices = () => screen.getAllByText(/^₹/).map((element) => element.textContent)

async function fillTraveller(user, values = {}) {
  const fields = {
    'First name': 'Asha',
    'Last name': 'Rao',
    Email: 'asha@example.com',
    'Phone number': '9876543210',
    ...values,
  }
  for (const [label, value] of Object.entries(fields)) {
    await user.clear(screen.getByLabelText(label))
    if (value) await user.type(screen.getByLabelText(label), value)
  }
}

async function fillTrip(user, { from = 'Chennai', to = 'Hyderabad', date = DATE } = {}) {
  await user.selectOptions(screen.getByLabelText('From'), from)
  await user.selectOptions(screen.getByLabelText('To'), to)
  await user.clear(screen.getByLabelText('Travel date'))
  await user.type(screen.getByLabelText('Travel date'), date)
}

async function reachResults(user) {
  await fillTraveller(user)
  await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
  await fillTrip(user)
  await user.click(screen.getByRole('button', { name: 'Search flights' }))
  await screen.findByRole('list', { name: 'Flights' })
}

async function browserHistory(direction) {
  const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
  await act(async () => {
    window.history[direction]()
    await popped
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
})

describe('flight search wizard', () => {
  it('walks through all three steps and lists the flights from the API', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)

    expect(heading()).toHaveTextContent('Who’s flying?')
    await reachResults(user)

    expect(heading()).toHaveTextContent('Chennai to Hyderabad')
    expect(screen.getByText('3 flights')).toBeInTheDocument()
    expect(prices()).toEqual(['₹5,200', '₹3,100', '₹7,400'])
    const [first] = within(screen.getByRole('list', { name: 'Flights' })).getAllByRole('listitem')
    expect(within(first).getByText('06:00')).toBeInTheDocument()
    expect(within(first).getByText('45m')).toBeInTheDocument()
    expect(within(first).getByText('Set 1')).toBeInTheDocument()
    expect(within(first).getByRole('img', { name: '3 out of 5 stars' })).toBeInTheDocument()
    expect(searchBodies(fetchMock)).toEqual([
      {
        first_name: 'Asha',
        last_name: 'Rao',
        email_id: 'asha@example.com',
        phone_no: '9876543210',
        travel_date: DATE,
        travel_from: 'Chennai',
        travel_to: 'Hyderabad',
        filters: [],
      },
    ])
  })

  it('trims surrounding whitespace before sending details', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)

    await fillTraveller(user, { 'First name': '  Asha ', Email: ' asha@example.com ' })
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))
    await screen.findByText('3 flights')

    expect(searchBodies(fetchMock)[0]).toMatchObject({ first_name: 'Asha', email_id: 'asha@example.com' })
  })

  it('moves focus to the heading of each new step', async () => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)

    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))

    expect(heading()).toHaveTextContent('Where are you flying?')
    expect(heading()).toHaveFocus()
  })
})

describe('step 1: traveller details', () => {
  it('blocks Continue, lists every missing field, and focuses the first one', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({})
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))

    expect(heading()).toHaveTextContent('Who’s flying?')
    expect(screen.getByText('Enter your first name')).toBeInTheDocument()
    expect(screen.getByText('Enter your last name')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your phone number')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveFocus()
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('First name')).toHaveAccessibleDescription('Enter your first name')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows no errors before the user interacts', () => {
    mockFetch({})
    render(<App />)

    expect(screen.queryByText(/^Enter your/)).not.toBeInTheDocument()
  })

  it.each([
    ['asha@', 'Enter an email address like name@example.com'],
    ['asha example.com', 'Enter an email address like name@example.com'],
  ])('rejects the email %j when the field loses focus', async (email, message) => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)

    await user.type(screen.getByLabelText('Email'), email)
    await user.tab()

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(message)
  })

  it.each(['98765', '98765432101', '98765abcde', '+919876543210'])(
    'rejects the phone number %j',
    async (phone) => {
      const user = userEvent.setup()
      mockFetch({})
      render(<App />)

      await fillTraveller(user, { 'Phone number': phone })
      await user.click(screen.getByRole('button', { name: 'Continue to trip' }))

      expect(heading()).toHaveTextContent('Who’s flying?')
      expect(screen.getByLabelText('Phone number')).toHaveAccessibleDescription(
        '10 digits, without the country code Phone number must be exactly 10 digits',
      )
      expect(screen.getByLabelText('Phone number')).toHaveFocus()
    },
  )

  it('clears an error as soon as the value becomes valid', async () => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)

    await user.type(screen.getByLabelText('Email'), 'asha@')
    await user.tab()
    expect(screen.getByText('Enter an email address like name@example.com')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'example.com')

    expect(screen.queryByText('Enter an email address like name@example.com')).not.toBeInTheDocument()
  })
})

describe('step 2: trip', () => {
  async function reachTrip(user) {
    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
  }

  it('offers only Chennai, Hyderabad and Bengaluru', async () => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)
    await reachTrip(user)

    for (const label of ['From', 'To']) {
      const options = within(screen.getByLabelText(label)).getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual([
        'Choose a city',
        'Chennai',
        'Hyderabad',
        'Bengaluru',
      ])
    }
  })

  it('blocks search when nothing is chosen', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({})
    render(<App />)
    await reachTrip(user)

    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(screen.getByText("Choose where you're flying from")).toBeInTheDocument()
    expect(screen.getByText("Choose where you're flying to")).toBeInTheDocument()
    expect(screen.getByText('Choose a travel date')).toBeInTheDocument()
    expect(screen.getByLabelText('From')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects the same city for source and destination', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({})
    render(<App />)
    await reachTrip(user)

    await fillTrip(user, { from: 'Bengaluru', to: 'Bengaluru' })
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(screen.getByText('Choose a destination different from Bengaluru')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a date in the past and sets today as the picker minimum', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({})
    render(<App />)
    await reachTrip(user)

    await fillTrip(user, { date: '2000-01-01' })
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(screen.getByText("Travel date can't be in the past")).toBeInTheDocument()
    expect(screen.getByLabelText('Travel date')).toHaveAttribute('min', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the traveller details when going back to step 1', async () => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)
    await reachTrip(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(heading()).toHaveTextContent('Who’s flying?')
    expect(screen.getByLabelText('First name')).toHaveValue('Asha')
    expect(screen.getByLabelText('Last name')).toHaveValue('Rao')
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com')
    expect(screen.getByLabelText('Phone number')).toHaveValue('9876543210')
  })
})

describe('step 3: results', () => {
  it('shows a loading state while the search is in flight', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => new Promise(() => {}) })
    render(<App />)

    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(screen.getByRole('status')).toHaveTextContent('Searching flights…')
  })

  it('sorts by price both ways without asking the API again', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)
    await reachResults(user)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high')
    expect(prices()).toEqual(['₹3,100', '₹5,200', '₹7,400'])

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: high to low')
    expect(prices()).toEqual(['₹7,400', '₹5,200', '₹3,100'])

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Departure time')
    expect(prices()).toEqual(['₹5,200', '₹3,100', '₹7,400'])

    expect(searchBodies(fetchMock)).toHaveLength(1)
  })

  it('sends the minimum rating to the API as a stars filter', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({ [SEARCH]: filteredFlights })
    render(<App />)
    await reachResults(user)

    await user.selectOptions(screen.getByLabelText('Rating'), '4 stars and up')

    await waitFor(() => expect(prices()).toEqual(['₹3,100', '₹7,400']))
    expect(screen.getByText('2 flights')).toBeInTheDocument()
    expect(searchBodies(fetchMock).at(-1).filters).toEqual([{ field: 'stars', op: 'gte', value: 4 }])
  })

  it('keeps the sort order when the rating filter changes', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: filteredFlights })
    render(<App />)
    await reachResults(user)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: high to low')
    await user.selectOptions(screen.getByLabelText('Rating'), '4 stars and up')

    await waitFor(() => expect(prices()).toEqual(['₹7,400', '₹3,100']))
  })

  it('offers to clear the rating filter when no flight is rated high enough', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({
      [SEARCH]: (options) =>
        JSON.parse(options.body).data.filters.length ? jsonResponse(200, []) : jsonResponse(200, FLIGHTS),
    })
    render(<App />)
    await reachResults(user)

    await user.selectOptions(screen.getByLabelText('Rating'), '5 stars')
    await user.click(await screen.findByRole('button', { name: 'Show all ratings' }))

    expect(await screen.findByText('3 flights')).toBeInTheDocument()
    expect(screen.getByLabelText('Rating')).toHaveValue('0')
    expect(searchBodies(fetchMock).at(-1).filters).toEqual([])
  })

  it('suggests changing the trip when the route has no flights', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => jsonResponse(200, []) })
    render(<App />)
    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(await screen.findByText(/^No flights from Chennai to Hyderabad on/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change trip' }))

    expect(heading()).toHaveTextContent('Where are you flying?')
    expect(screen.getByLabelText('From')).toHaveValue('Chennai')
    expect(screen.getByLabelText('Travel date')).toHaveValue(DATE)
  })

  it('shows the API error and retries on request', async () => {
    const user = userEvent.setup()
    let calls = 0
    const fetchMock = mockFetch({
      [SEARCH]: () => {
        calls += 1
        return calls === 1
          ? jsonResponse(503, { detail: 'Database unavailable' })
          : jsonResponse(200, FLIGHTS)
      },
    })
    render(<App />)
    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t load flights. Database unavailable',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('3 flights')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(searchBodies(fetchMock)).toHaveLength(2)
  })

  it.each([
    [
      'an unreachable API',
      () => {
        throw new TypeError('Failed to fetch')
      },
      'Cannot reach API at http://api.test/api/flight-listings',
    ],
    ['a malformed response', () => jsonResponse(200, { flights: [] }), 'API returned an unexpected response'],
    [
      'a rejected request',
      () => jsonResponse(422, { detail: [{ msg: 'Input should be a valid date' }] }),
      'Input should be a valid date',
    ],
  ])('reports %s', async (_, handler, message) => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: handler })
    render(<App />)
    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('ignores a slow response that arrives after a newer search', async () => {
    const user = userEvent.setup()
    let releaseFirst
    mockFetch({
      [SEARCH]: (options) => {
        const { filters } = JSON.parse(options.body).data
        if (filters.length) return filteredFlights(options)
        return new Promise((resolve) => {
          releaseFirst = () => resolve(jsonResponse(200, FLIGHTS))
        })
      },
    })
    render(<App />)
    await fillTraveller(user)
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))
    await fillTrip(user)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))
    await user.selectOptions(screen.getByLabelText('Rating'), '5 stars')
    await screen.findByText('1 flight')

    await act(async () => releaseFirst())

    expect(screen.getByText('1 flight')).toBeInTheDocument()
    expect(prices()).toEqual(['₹7,400'])
  })
})

describe('editing earlier steps', () => {
  it('edits traveller details from the results and keeps the trip, sort and rating', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch({ [SEARCH]: filteredFlights })
    render(<App />)
    await reachResults(user)
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high')
    await user.selectOptions(screen.getByLabelText('Rating'), '4 stars and up')
    await screen.findByText('2 flights')

    await user.click(screen.getByRole('button', { name: 'Your details' }))
    expect(heading()).toHaveTextContent('Who’s flying?')
    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Iyer')
    await user.click(screen.getByRole('button', { name: 'Continue to trip' }))

    expect(screen.getByLabelText('From')).toHaveValue('Chennai')
    expect(screen.getByLabelText('To')).toHaveValue('Hyderabad')
    expect(screen.getByLabelText('Travel date')).toHaveValue(DATE)
    await user.click(screen.getByRole('button', { name: 'Search flights' }))

    expect(await screen.findByText('2 flights')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toHaveValue('price-asc')
    expect(screen.getByLabelText('Rating')).toHaveValue('4')
    expect(prices()).toEqual(['₹3,100', '₹7,400'])
    expect(searchBodies(fetchMock).at(-1)).toMatchObject({
      last_name: 'Iyer',
      first_name: 'Asha',
      travel_from: 'Chennai',
      filters: [{ field: 'stars', op: 'gte', value: 4 }],
    })
  })

  it('jumps straight from step 1 back to the results once everything is valid', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)
    await reachResults(user)

    await user.click(screen.getByRole('button', { name: 'Your details' }))
    await user.click(screen.getByRole('button', { name: 'Flights' }))

    expect(await screen.findByText('3 flights')).toBeInTheDocument()
  })

  it('links only to steps that can be entered', async () => {
    const user = userEvent.setup()
    mockFetch({})
    render(<App />)
    const steps = screen.getByRole('navigation', { name: 'Booking steps' })

    expect(within(steps).queryAllByRole('button')).toHaveLength(0)
    expect(within(steps).getByText('Your details').closest('li')).toHaveAttribute('aria-current', 'step')

    await fillTraveller(user)
    expect(within(steps).getByRole('button', { name: 'Trip' })).toBeInTheDocument()
    expect(within(steps).queryByRole('button', { name: 'Flights' })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Email'))
    expect(within(steps).queryByRole('button', { name: 'Trip' })).not.toBeInTheDocument()
  })

  it('removes the link to the results when an earlier step becomes invalid', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)
    await reachResults(user)
    const steps = screen.getByRole('navigation', { name: 'Booking steps' })

    await user.click(within(steps).getByRole('button', { name: 'Your details' }))
    await user.clear(screen.getByLabelText('Phone number'))
    await user.type(screen.getByLabelText('Phone number'), '12345')

    expect(within(steps).queryByRole('button', { name: 'Flights' })).not.toBeInTheDocument()
    expect(within(steps).queryByRole('button', { name: 'Trip' })).not.toBeInTheDocument()
  })
})

describe('browser history', () => {
  it('moves between steps with Back and Forward and keeps every field', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)
    await reachResults(user)

    await browserHistory('back')
    expect(heading()).toHaveTextContent('Where are you flying?')
    expect(screen.getByLabelText('To')).toHaveValue('Hyderabad')

    await browserHistory('back')
    expect(heading()).toHaveTextContent('Who’s flying?')
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com')

    await browserHistory('forward')
    expect(heading()).toHaveTextContent('Where are you flying?')
    expect(screen.getByLabelText('Travel date')).toHaveValue(DATE)
  })

  it('stays put when history points at a step that no longer validates', async () => {
    const user = userEvent.setup()
    mockFetch({ [SEARCH]: () => jsonResponse(200, FLIGHTS) })
    render(<App />)
    await reachResults(user)
    await user.click(screen.getByRole('button', { name: 'Your details' }))
    await user.clear(screen.getByLabelText('Email'))

    await browserHistory('back')

    expect(heading()).toHaveTextContent('Who’s flying?')
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })
})
