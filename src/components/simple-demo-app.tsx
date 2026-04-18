'use client'

import {
  ApiOutlined,
  ArrowRightOutlined,
  CopyOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Input,
  Result,
  Select,
  Space
} from 'antd'
import { useMemo, useState } from 'react'

import { AppShell } from '@/components/ui/app-shell'

type GeneratedRouteResponse = {
  route: {
    id: string
    slug: string
    routeName: string
    priceAmount: string
    currency: string
    description?: string
    httpMethod?: string
  }
  upstreamUrl?: string
  gatewayUrl: string
  payment: {
    network: string
    chainId: number
    currencyContract: string
  }
  examples: {
    curl: string
    mppx: string
    sampleBody: string
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Request failed.')
  }

  return body as T
}

export function SimpleDemoApp() {
  const { message } = AntApp.useApp()
  const [form, setForm] = useState({
    upstreamUrl: '',
    routeName: '',
    httpMethod: 'POST'
  })
  const [generated, setGenerated] = useState<GeneratedRouteResponse | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const liveDemoUrl = useMemo(() => {
    if (!generated) {
      return null
    }

    return `/demo/${generated.route.slug}`
  }, [generated])

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      message.success(`${label} copied.`)
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}.`)
    }
  }

  async function createPaidEndpoint() {
    setBusy(true)
    setError(null)

    try {
      const payload = await parseOrThrow<GeneratedRouteResponse>(
        await fetch('/api/demo/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
      )

      setGenerated(payload)
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create the paid endpoint.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell current="home">
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack" style={{ gridColumn: '1 / -1' }}>
              <div className="section-heading">
                <h1 className="section-title">
                  Turbocharge your paid APIs with Agentic On-chain Payments
                </h1>
                <p className="section-copy">
                  This page only does one job: generate a monetized endpoint.
                  The next page spins up a fresh agent wallet, funds it on Tempo
                  testnet, pays the endpoint, and shows the unlocked response.
                </p>
              </div>

              <div className="journey-flow" aria-label="Transaction journey">
                <div className="journey-step">
                  <div className="journey-step__icon">
                    <LinkOutlined />
                  </div>
                  <div className="journey-step__body">
                    <div className="journey-step__eyebrow">Step 1</div>
                    <div className="journey-step__title">
                      Generate payment URL
                    </div>
                    <p className="journey-step__copy">
                      Create the paid endpoint that the agent will target.
                    </p>
                  </div>
                </div>

                <div className="journey-arrow" aria-hidden="true">
                  <ArrowRightOutlined />
                </div>

                <div className="journey-step">
                  <div className="journey-step__icon">
                    <WalletOutlined />
                  </div>
                  <div className="journey-step__body">
                    <div className="journey-step__eyebrow">Step 2</div>
                    <div className="journey-step__title">
                      Confirm transaction
                    </div>
                    <p className="journey-step__copy">
                      Fund the agent wallet with real Tempo testnet funds.
                    </p>
                  </div>
                </div>

                <div className="journey-arrow" aria-hidden="true">
                  <ArrowRightOutlined />
                </div>

                <div className="journey-step">
                  <div className="journey-step__icon">
                    <ApiOutlined />
                  </div>
                  <div className="journey-step__body">
                    <div className="journey-step__eyebrow">Step 3</div>
                    <div className="journey-step__title">
                      Serve paywalled data
                    </div>
                    <p className="journey-step__copy">
                      The agent pays the endpoint and receives the response
                      immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="content-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: '100%' }}>
              <div className="section-heading">
                <span className="section-kicker">Create endpoint</span>
                <h2 style={{ margin: 0 }}>Generate the route</h2>
                <p className="section-copy">
                  The upstream URL is optional for the demo. If you leave it
                  blank, the app will connect the paid route to an internal
                  sample API.
                </p>
              </div>

              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                <div>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    Upstream API URL
                  </div>
                  <Input
                    size="large"
                    placeholder="Leave empty to use the built-in demo upstream"
                    value={form.upstreamUrl}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        upstreamUrl: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="detail-grid">
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      Endpoint label
                    </div>
                    <Input
                      size="large"
                      placeholder="Premium summary API"
                      value={form.routeName}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          routeName: event.target.value
                        }))
                      }
                    />
                  </div>

                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      HTTP method
                    </div>
                    <Select
                      size="large"
                      value={form.httpMethod}
                      onChange={value =>
                        setForm(current => ({ ...current, httpMethod: value }))
                      }
                      options={[
                        { label: "POST", value: "POST" },
                        { label: "GET", value: "GET" },
                      ]}
                    />
                  </div>
                </div>

                <Button
                  type="primary"
                  size="large"
                  icon={<ThunderboltOutlined />}
                  loading={busy}
                  onClick={() => void createPaidEndpoint()}
                >
                  Create paid endpoint
                </Button>

                {error ? <Alert type="error" title={error} showIcon /> : null}
              </Space>
            </Space>
          </Card>

          <Card className="section-surface">
            {generated ? (
              <Space orientation="vertical" size={18} style={{ width: '100%' }}>
                <div className="section-heading">
                  <span className="section-kicker">Endpoint created</span>
                  <h2 style={{ margin: 0 }}>{generated.route.routeName}</h2>
                  <p className="section-copy">
                    Your paid endpoint is ready. Open page two to watch a
                    dedicated agent wallet get funded, pay this endpoint, and
                    reveal the final response.
                  </p>
                </div>

                <Descriptions
                  column={1}
                  items={[
                    {
                      key: 'upstream',
                      label: 'Upstream',
                      children: (
                        <span className="inline-code">
                          {generated.upstreamUrl ?? 'Built-in demo upstream'}
                        </span>
                      )
                    },
                    {
                      key: 'paid',
                      label: 'Gateway URL',
                      children: (
                        <span className="inline-code">
                          {generated.gatewayUrl}
                        </span>
                      )
                    },
                    {
                      key: 'price',
                      label: 'Price',
                      children: `${generated.route.priceAmount} ${generated.route.currency}`
                    },
                    {
                      key: 'network',
                      label: 'Payment rail',
                      children: `${generated.payment.network} · chain ${generated.payment.chainId}`
                    }
                  ]}
                />

                <div className="card-actions">
                  <Button
                    type="primary"
                    href={liveDemoUrl ?? undefined}
                    icon={<ArrowRightOutlined />}
                  >
                    Open live payment demo
                  </Button>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      void copy(generated.gatewayUrl, 'Paid endpoint')
                    }
                  >
                    Copy endpoint
                  </Button>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      void copy(generated.examples.mppx, 'mppx command')
                    }
                  >
                    Copy mppx example
                  </Button>
                </div>

                <Alert
                  type="success"
                  showIcon
                  title="Next step"
                  description="Use the live demo page to fund the agent wallet on Tempo testnet, execute the paid call, and inspect the unlocked API response."
                />
              </Space>
            ) : (
              <Result
                status="info"
                title="No endpoint created yet"
                subTitle="Generate a paid endpoint and the launch link for page two will appear here."
              />
            )}
          </Card>
        </div>

        {generated ? (
          <div className="detail-grid">
            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <span className="section-kicker">Challenge request</span>
                <pre className="code-block">{generated.examples.curl}</pre>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void copy(generated.examples.curl, 'curl command')
                  }
                >
                  Copy curl command
                </Button>
              </Space>
            </Card>

            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <span className="section-kicker">Live demo page</span>
                <Descriptions
                  column={1}
                  items={[
                    {
                      key: 'route',
                      label: 'Demo URL',
                      children: (
                        <span className="inline-code">{liveDemoUrl}</span>
                      )
                    },
                    {
                      key: 'sample',
                      label: 'Sample request body',
                      children: (
                        <span className="inline-code">
                          {generated.examples.sampleBody}
                        </span>
                      )
                    }
                  ]}
                />
                <Button icon={<LinkOutlined />} href={liveDemoUrl ?? undefined}>
                  Open page two
                </Button>
              </Space>
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
