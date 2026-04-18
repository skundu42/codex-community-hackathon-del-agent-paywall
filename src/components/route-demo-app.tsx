'use client'

import {
  ArrowLeftOutlined,
  CopyOutlined,
  LinkOutlined,
  RobotOutlined,
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
  Space,
  Spin,
  Statistic,
  Tag
} from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/ui/app-shell'
import { formatStatusLabel, getStatusColor } from '@/lib/ui'
import type { ApiInvocationResult, PublicApiRoute } from '@/lib/types'

const BODYLESS_METHODS = new Set(["GET"]);
const AGENT_FUND_AMOUNT = "0.10";

type RouteContractPayload = {
  route: PublicApiRoute
  gatewayUrl: string
  payment: {
    method: string
    network: string
    chainId: number
    currencyContract: string
    explorerBaseUrl: string
    rpcUrl: string
  }
  examples: {
    curl: string
    mppx: string
    sampleBody: string
  }
}

type AgentWalletPayload = {
  id: string
  address: string
  routeSlug: string
  balance: {
    raw: string
    formatted: string
    symbol: string
  }
  lastFundingTxHash?: string
  lastFundingExplorerUrl?: string | null
  lastPaymentReference?: string
  lastPaymentExplorerUrl?: string | null
  createdAt: string
  updatedAt: string
}

type AgentCreateResponse = {
  agent: AgentWalletPayload
}

type AgentFundResponse = {
  agent: AgentWalletPayload
  fundedAmount: string
}

type AgentInvokeResponse = {
  agent: AgentWalletPayload
  invocationId: string
  paymentReference: string
  paymentExplorerUrl?: string | null
  result: ApiInvocationResult
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? 'Request failed.')
  }

  return body as T
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function prettyResult(result: ApiInvocationResult | null) {
  if (!result) {
    return ''
  }

  if (result.kind === 'proxy') {
    return formatJson({
      upstreamStatus: result.upstreamStatus,
      upstreamHeaders: result.upstreamHeaders,
      responseBody: result.responseBody
    })
  }

  return formatJson(result)
}

function getUpstreamFailureDetails(
  result: ApiInvocationResult | null,
  method?: string
) {
  if (!result || result.kind !== 'proxy' || result.upstreamStatus < 400) {
    return null
  }

  const routeMethod = method ?? 'POST'

  if (
    result.upstreamStatus === 404 &&
    typeof result.responseBody === 'string' &&
    result.responseBody.includes(`Cannot ${routeMethod} `)
  ) {
    return {
      title:
        'Payment succeeded, but the upstream endpoint rejected this HTTP method.',
      description: `Your paid route is sending ${routeMethod} to the upstream API, and that upstream path does not accept ${routeMethod}. Point the route at the correct upstream path or recreate it with the method the upstream actually supports.`,
      type: 'warning' as const
    }
  }

  if (result.upstreamStatus === 404) {
    return {
      title: 'Payment succeeded, but the upstream endpoint was not found.',
      description:
        'The paid route executed, but the upstream URL returned 404. Check the upstream path and base URL.',
      type: 'warning' as const
    }
  }

  if (result.upstreamStatus === 405) {
    return {
      title:
        'Payment succeeded, but the upstream API does not allow this method.',
      description: `The upstream returned 405 for ${routeMethod}. Recreate the route with the correct method or point it to the upstream endpoint that accepts ${routeMethod}.`,
      type: 'warning' as const
    }
  }

  return {
    title: 'Payment succeeded, but the upstream API returned an error.',
    description: `The gateway paid and invoked the route correctly, but the upstream responded with status ${result.upstreamStatus}.`,
    type: 'error' as const
  }
}

export function RouteDemoApp({ slug }: { slug: string }) {
  const { message } = AntApp.useApp()
  const [details, setDetails] = useState<RouteContractPayload | null>(null)
  const [agent, setAgent] = useState<AgentWalletPayload | null>(null)
  const [requestBodyText, setRequestBodyText] = useState(
    '{\n  "prompt": "Summarize the billing event"\n}'
  )
  const [result, setResult] = useState<ApiInvocationResult | null>(null)
  const [invocationId, setInvocationId] = useState<string | null>(null)
  const [paymentReference, setPaymentReference] = useState<string | null>(null)
  const [paymentExplorerUrl, setPaymentExplorerUrl] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [busyAction, setBusyAction] = useState<'fund' | 'invoke' | null>(null)

  const isBodylessMethod = BODYLESS_METHODS.has(
    details?.route.httpMethod ?? 'POST'
  )
  const formattedResponse = useMemo(() => prettyResult(result), [result])
  const upstreamFailure = useMemo(
    () => getUpstreamFailureDetails(result, details?.route.httpMethod),
    [details?.route.httpMethod, result]
  )
  const agentBalance = Number(agent?.balance.formatted ?? '0')
  const routePrice = Number(details?.route.priceAmount ?? '0')
  const canInvoke = Boolean(agent && details && agentBalance >= routePrice)

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      message.success(`${label} copied.`)
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}.`)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const routePayload = await parseOrThrow<RouteContractPayload>(
          await fetch(`/api/routes/${slug}`, { cache: 'no-store' })
        )

        if (cancelled) {
          return
        }

        setDetails(routePayload)
        if (!BODYLESS_METHODS.has(routePayload.route.httpMethod ?? 'POST')) {
          setRequestBodyText(routePayload.examples.sampleBody)
        }

        const agentPayload = await parseOrThrow<AgentCreateResponse>(
          await fetch(`/api/demo/routes/${slug}/agent`, {
            method: 'POST'
          })
        )

        if (!cancelled) {
          setAgent(agentPayload.agent)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load the route.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  function parseRequestBody() {
    if (isBodylessMethod) {
      return undefined
    }

    const trimmed = requestBodyText.trim()
    if (!trimmed) {
      return undefined
    }

    try {
      return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      throw new Error('Request body must be valid JSON.')
    }
  }

  async function fundAgent() {
    if (!agent) {
      return
    }

    setBusyAction('fund')
    setError(null)

    try {
      const payload = await parseOrThrow<AgentFundResponse>(
        await fetch(`/api/demo/routes/${slug}/agent/fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id
          })
        })
      )

      setAgent(payload.agent)
      message.success(
        `Agent funded with ${payload.fundedAmount} testnet funds.`
      )
    } catch (fundError) {
      setError(
        fundError instanceof Error
          ? fundError.message
          : 'Unable to fund the agent.'
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function invokeRoute() {
    if (!agent) {
      return
    }

    setBusyAction('invoke')
    setError(null)

    try {
      const payload = await parseOrThrow<AgentInvokeResponse>(
        await fetch(`/api/demo/routes/${slug}/agent/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            requestBody: parseRequestBody()
          })
        })
      )

      setAgent(payload.agent)
      setInvocationId(payload.invocationId)
      setPaymentReference(payload.paymentReference)
      setPaymentExplorerUrl(payload.paymentExplorerUrl ?? null)
      setResult(payload.result)
      message.success('Agent paid the endpoint and received the response.')
    } catch (invokeError) {
      const message =
        invokeError instanceof Error
          ? invokeError.message
          : 'Unable to call the paid endpoint.'
      setError(message)

      if (/agent not found/i.test(message)) {
        try {
          const refreshed = await parseOrThrow<AgentCreateResponse>(
            await fetch(`/api/demo/routes/${slug}/agent`, {
              method: 'POST'
            })
          )
          setAgent(refreshed.agent)
          setError(
            'The demo agent was reset by the server. A fresh agent has been created; fund it again and retry.'
          )
        } catch {
          setError(message)
        }
      }
    } finally {
      setBusyAction(null)
    }
  }

  if (loadingPage) {
    return (
      <AppShell current="demo">
        <Result
          icon={<Spin size="large" />}
          title="Booting the live Tempo agent flow..."
        />
      </AppShell>
    )
  }

  if (!details || !agent) {
    return (
      <AppShell current="demo">
        <Result status="error" title={error ?? 'Route not found.'} />
      </AppShell>
    )
  }

  return (
    <AppShell
      current="demo"
      headerExtra={
        <Button href="/" icon={<ArrowLeftOutlined />}>
          Create another endpoint
        </Button>
      }
    >
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack demo-hero-stack">
              <div className="section-heading">
                <h1 className="section-title">
                  Fund the agent, then let it pay and call the API.
                </h1>
              </div>

              <div className="demo-hero-row">
                <Card className="section-surface demo-agent-card">
                  <Space
                    orientation="vertical"
                    size={18}
                    style={{ width: '100%' }}
                  >
                    {/* <Tag color="blue" icon={<RobotOutlined />}> */}
                    {/* Dedicated demo agent */}
                    {/* </Tag> */}

                    <div className="agent-badge">
                      <div className="agent-badge__icon">
                        <RobotOutlined />
                      </div>
                      <div className="agent-badge__body">
                        <div className="agent-badge__label">Agent wallet</div>
                        <div className="agent-badge__value">
                          {agent.address}
                        </div>
                      </div>
                    </div>

                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'gateway',
                          label: 'Paid endpoint',
                          children: (
                            <span className="inline-code">
                              {details.gatewayUrl}
                            </span>
                          )
                        },
                        {
                          key: 'network',
                          label: 'Tempo network',
                          children: `${details.payment.network} · chain ${details.payment.chainId}`
                        },
                        {
                          key: 'balance',
                          label: 'Current balance',
                          children: (
                            <Tag
                              color={agentBalance > 0 ? 'success' : 'default'}
                            >
                              {agent.balance.formatted} USD
                            </Tag>
                          )
                        }
                      ]}
                    />

                    <div className="card-actions">
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={busyAction === 'fund'}
                        disabled={
                          busyAction !== null ||
                          agentBalance >= Number(AGENT_FUND_AMOUNT)
                        }
                        onClick={() => void fundAgent()}
                      >
                        Fund agent with {AGENT_FUND_AMOUNT}
                      </Button>
                      <Button
                        icon={<CopyOutlined />}
                        onClick={() => void copy(agent.address, 'Agent wallet')}
                      >
                        Copy agent wallet
                      </Button>
                    </div>
                  </Space>
                </Card>

                <div className="metric-grid demo-metric-grid">
                  <Card>
                    <Statistic
                      title="Agent balance"
                      value={`${agent.balance.formatted} USD`}
                      prefix={<RobotOutlined />}
                    />
                  </Card>
                  <Card>
                    <Statistic
                      title="Price to pay / API"
                      value={`${details.route.priceAmount} USD`}
                      prefix={<WalletOutlined />}
                    />
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? <Alert type="error" title={error} showIcon /> : null}

        <div className="content-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: '100%' }}>
              <div className="section-heading">
                <span className="section-kicker">Agent request</span>
                <h2 style={{ margin: 0 }}>Prepare the API input</h2>
                <p className="section-copy">
                  The agent will send this payload to the paid endpoint after
                  its wallet has enough Tempo testnet funds.
                </p>
              </div>

              {isBodylessMethod ? (
                <Alert
                  type="info"
                  showIcon
                  title={`${details.route.httpMethod} requests do not send a request body.`}
                />
              ) : (
                <div>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    JSON request body
                  </div>
                  <Input.TextArea
                    rows={12}
                    value={requestBodyText}
                    onChange={event => setRequestBodyText(event.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}

              <div className="card-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<RobotOutlined />}
                  loading={busyAction === 'invoke'}
                  disabled={!canInvoke || busyAction !== null}
                  onClick={() => void invokeRoute()}
                >
                  Pay endpoint and call API
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void copy(
                      details.examples.sampleBody,
                      'Sample request body'
                    )
                  }
                  disabled={isBodylessMethod}
                >
                  Copy sample body
                </Button>
              </div>

              {!canInvoke ? (
                <Alert
                  type="warning"
                  showIcon
                  title="The agent needs funding first."
                  description={`Fund the agent with ${AGENT_FUND_AMOUNT} on Tempo testnet before it can pay ${details.route.priceAmount} ${details.route.currency}.`}
                />
              ) : null}
            </Space>
          </Card>

          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: '100%' }}>
              <div className="section-heading">
                <span className="section-kicker">Onchain proof</span>
                <h2 style={{ margin: 0 }}>Funding and payment state</h2>
                <p className="section-copy">
                  Both buttons on this page trigger real Tempo testnet activity:
                  first a token transfer into the agent wallet, then a paid API
                  call against the endpoint.
                </p>
              </div>

              <Descriptions
                column={1}
                items={[
                  {
                    key: 'funding',
                    label: 'Funding transaction',
                    children: agent.lastFundingTxHash ? (
                      <Space>
                        <span className="inline-code">
                          {agent.lastFundingTxHash}
                        </span>
                        <Tag color="success">{formatStatusLabel('funded')}</Tag>
                      </Space>
                    ) : (
                      <Tag color="default">Not funded</Tag>
                    )
                  },
                  {
                    key: 'payment',
                    label: 'Payment reference',
                    children: paymentReference ? (
                      <Space>
                        <span className="inline-code">{paymentReference}</span>
                        <Tag color={getStatusColor('paid')}>
                          {formatStatusLabel('paid')}
                        </Tag>
                      </Space>
                    ) : (
                      <Tag color="default">No payment yet</Tag>
                    )
                  },
                  {
                    key: 'invocation',
                    label: 'Invocation',
                    children: invocationId ? (
                      <span className="inline-code">{invocationId}</span>
                    ) : (
                      'Not called yet'
                    )
                  }
                ]}
              />

              <div className="card-actions">
                {agent.lastFundingExplorerUrl ? (
                  <Button
                    icon={<LinkOutlined />}
                    href={agent.lastFundingExplorerUrl}
                    target="_blank"
                  >
                    Open funding tx
                  </Button>
                ) : null}
                {paymentExplorerUrl ? (
                  <Button
                    icon={<LinkOutlined />}
                    href={paymentExplorerUrl}
                    target="_blank"
                  >
                    Open payment tx
                  </Button>
                ) : null}
                <Button
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void copy(details.examples.mppx, 'mppx example')
                  }
                >
                  Copy mppx example
                </Button>
              </div>
            </Space>
          </Card>
        </div>

        <Card className="section-surface">
          <Space orientation="vertical" size={18} style={{ width: '100%' }}>
            <div className="section-heading">
              <span className="section-kicker">Unlocked response</span>
              <h2 style={{ margin: 0 }}>Final API output</h2>
            </div>

            {result ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type={upstreamFailure?.type ?? 'success'}
                  showIcon
                  title={
                    upstreamFailure?.title ??
                    'Agent payment succeeded and the endpoint response is unlocked.'
                  }
                  description={
                    upstreamFailure?.description ??
                    (paymentReference
                      ? `Payment reference: ${paymentReference}`
                      : 'The paid request completed successfully.')
                  }
                />

                {paymentReference ? (
                  <div className="muted">
                    Payment reference: {paymentReference}
                  </div>
                ) : null}

                <div className="response-shell">
                  <pre className="code-block">{formattedResponse}</pre>
                </div>
              </Space>
            ) : (
              <Result
                status="info"
                title="Response is still locked"
                subTitle="Fund the agent and let it call the endpoint to reveal the final API response here."
              />
            )}
          </Space>
        </Card>
      </div>
    </AppShell>
  )
}
