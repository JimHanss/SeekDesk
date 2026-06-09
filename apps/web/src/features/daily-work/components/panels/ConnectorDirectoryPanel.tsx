"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Square
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  connectorFilterCount,
  connectorFilters,
  connectorItems
} from "../../domain";
import type {
  ApprovalRequestItem,
  ApprovalStatus,
  ConnectorFilter,
  ConnectorItem,
  ConnectorPreviewPanelState,
  GoogleConnectorStatusState,
  GoogleOAuthStartStatus,
  MicrosoftConnectorStatusState,
  MicrosoftOAuthStartStatus
} from "../../types";
import {
  ConnectorPermissionPill,
  ConnectorRiskPill,
  StatusPill,
  StatusRow
} from "../DailyWorkPrimitives";

interface ConnectorDirectoryPanelProps {
  connectorFilter: ConnectorFilter;
  connectorPreviewPanel: ConnectorPreviewPanelState;
  filteredConnectors: ConnectorItem[];
  googleConnectorStatus: GoogleConnectorStatusState;
  googleOAuthStartNotice: string;
  googleOAuthStartStatus: GoogleOAuthStartStatus;
  microsoftConnectorStatus: MicrosoftConnectorStatusState;
  microsoftOAuthStartNotice: string;
  microsoftOAuthStartStatus: MicrosoftOAuthStartStatus;
  selectedConnector: ConnectorItem | null;
  selectedConnectorApprovalRequests: ApprovalRequestItem[];
  selectedConnectorPreviewStatus: ApprovalStatus;
  onApplyConnectorPrompt: (connector: ConnectorItem) => void;
  onFilterChange: (filter: ConnectorFilter) => void;
  onRefreshGoogleStatus: () => void;
  onRefreshMicrosoftStatus: () => void;
  onSelectConnector: (connectorId: string) => void;
  onStartGoogleOAuth: () => void;
  onStartMicrosoftOAuth: () => void;
  onUpdateConnectorPreviewDecision: (
    connector: ConnectorItem,
    nextStatus: Exclude<ApprovalStatus, "waiting">
  ) => void;
}

export function ConnectorDirectoryPanel({
  connectorFilter,
  connectorPreviewPanel,
  filteredConnectors,
  googleConnectorStatus,
  googleOAuthStartNotice,
  googleOAuthStartStatus,
  microsoftConnectorStatus,
  microsoftOAuthStartNotice,
  microsoftOAuthStartStatus,
  selectedConnector,
  selectedConnectorApprovalRequests,
  selectedConnectorPreviewStatus,
  onApplyConnectorPrompt,
  onFilterChange,
  onRefreshGoogleStatus,
  onRefreshMicrosoftStatus,
  onSelectConnector,
  onStartGoogleOAuth,
  onStartMicrosoftOAuth,
  onUpdateConnectorPreviewDecision
}: ConnectorDirectoryPanelProps) {
  const googleOauthBlocked =
    (googleConnectorStatus.connected && googleConnectorStatus.scopesComplete) ||
    googleConnectorStatus.syncStatus === "syncing" ||
    googleOAuthStartStatus === "starting" ||
    googleConnectorStatus.missingConfig.length > 0;
  const googleScopeStatus = googleConnectorStatus.scopesComplete
    ? "complete"
    : "incomplete";
  const microsoftOauthBlocked =
    (microsoftConnectorStatus.connected &&
      microsoftConnectorStatus.scopesComplete) ||
    microsoftConnectorStatus.syncStatus === "syncing" ||
    microsoftOAuthStartStatus === "starting" ||
    microsoftConnectorStatus.missingConfig.length > 0;
  const microsoftScopeStatus = microsoftConnectorStatus.scopesComplete
    ? "complete"
    : "incomplete";

  return (
    <div className="rounded-[8px] border border-teal-100 bg-teal-50 p-3">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm font-medium text-teal-950">
            <Globe className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            <span className="min-w-0 break-words">Connector Directory</span>
          </div>
          <span className="shrink-0 rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700">
            {filteredConnectors.length}/{connectorItems.length}
          </span>
        </div>
        <p className="text-xs leading-5 text-teal-700">
          Email connectors use user authorization windows to read approved mailbox
          and calendar context, then create local previews. They never send email
          or create calendar events.
        </p>

        <div
          className="rounded-[8px] border border-teal-200 bg-white px-3 py-2 text-xs leading-5 text-teal-900"
          data-google-connector-status={
            googleConnectorStatus.connected ? "connected" : "requires_setup"
          }
          data-google-connector-sync-status={googleConnectorStatus.syncStatus}
          data-google-scope-status={googleScopeStatus}
          data-google-missing-scope-count={googleConnectorStatus.missingScopes.length}
          data-google-oauth-start-status={googleOAuthStartStatus}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  Email:{" "}
                  {googleConnectorStatus.connected ? "authorized" : "requires_setup"}
                </span>
                <span className="rounded-[999px] bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700">
                  {googleConnectorStatus.scopes.length} scopes
                </span>
                <span
                  className={cn(
                    "rounded-[999px] px-2 py-0.5 text-[11px]",
                    googleConnectorStatus.scopesComplete
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-orange-50 text-orange-700"
                  )}
                >
                  scopes {googleScopeStatus}
                </span>
              </div>
              <p className="mt-1 text-teal-700">{googleConnectorStatus.notice}</p>
              {googleConnectorStatus.missingConfig.length > 0 ? (
                <p className="mt-1 break-words text-orange-700">
                  Missing: {googleConnectorStatus.missingConfig.join(", ")}
                </p>
              ) : null}
              {googleConnectorStatus.missingScopes.length > 0 ? (
                <p className="mt-1 break-words text-orange-700">
                  Missing scopes: {googleConnectorStatus.missingScopes.join(", ")}
                </p>
              ) : null}
              <p className="mt-1 break-words text-[11px] text-slate-600">
                {googleOAuthStartNotice}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-[8px] border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
                data-google-connector-refresh
                onClick={onRefreshGoogleStatus}
              >
                {googleConnectorStatus.syncStatus === "syncing" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={googleOauthBlocked}
                className="h-8 rounded-[8px] border-teal-200 bg-white text-teal-800 hover:bg-teal-50"
                data-google-oauth-start
                data-google-oauth-start-disabled={String(googleOauthBlocked)}
                onClick={onStartGoogleOAuth}
              >
                {googleOAuthStartStatus === "starting" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="size-4" aria-hidden="true" />
                )}
                {googleConnectorStatus.connected
                  ? googleConnectorStatus.scopesComplete
                    ? "Authorized"
                    : "Refresh scopes"
                  : googleConnectorStatus.missingConfig.length > 0
                    ? "Setup needed"
                    : "Authorize email"}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="rounded-[8px] border border-cyan-200 bg-white px-3 py-2 text-xs leading-5 text-cyan-950"
          data-microsoft-connector-status={
            microsoftConnectorStatus.connected ? "connected" : "requires_setup"
          }
          data-microsoft-connector-sync-status={microsoftConnectorStatus.syncStatus}
          data-microsoft-scope-status={microsoftScopeStatus}
          data-microsoft-missing-scope-count={
            microsoftConnectorStatus.missingScopes.length
          }
          data-microsoft-oauth-start-status={microsoftOAuthStartStatus}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  Outlook / Microsoft:{" "}
                  {microsoftConnectorStatus.connected
                    ? "authorized"
                    : "requires_setup"}
                </span>
                <span className="rounded-[999px] bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                  {microsoftConnectorStatus.scopes.length} scopes
                </span>
                <span
                  className={cn(
                    "rounded-[999px] px-2 py-0.5 text-[11px]",
                    microsoftConnectorStatus.scopesComplete
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-orange-50 text-orange-700"
                  )}
                >
                  scopes {microsoftScopeStatus}
                </span>
              </div>
              <p className="mt-1 text-cyan-800">
                {microsoftConnectorStatus.notice}
              </p>
              {microsoftConnectorStatus.missingConfig.length > 0 ? (
                <p className="mt-1 break-words text-orange-700">
                  Missing: {microsoftConnectorStatus.missingConfig.join(", ")}
                </p>
              ) : null}
              {microsoftConnectorStatus.missingScopes.length > 0 ? (
                <p className="mt-1 break-words text-orange-700">
                  Missing scopes:{" "}
                  {microsoftConnectorStatus.missingScopes.join(", ")}
                </p>
              ) : null}
              <p className="mt-1 break-words text-[11px] text-slate-600">
                {microsoftOAuthStartNotice}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-[8px] border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
                data-microsoft-connector-refresh
                onClick={onRefreshMicrosoftStatus}
              >
                {microsoftConnectorStatus.syncStatus === "syncing" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={microsoftOauthBlocked}
                className="h-8 rounded-[8px] border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
                data-microsoft-oauth-start
                data-microsoft-oauth-start-disabled={String(microsoftOauthBlocked)}
                onClick={onStartMicrosoftOAuth}
              >
                {microsoftOAuthStartStatus === "starting" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="size-4" aria-hidden="true" />
                )}
                {microsoftConnectorStatus.connected
                  ? microsoftConnectorStatus.scopesComplete
                    ? "Authorized"
                    : "Refresh scopes"
                  : microsoftConnectorStatus.missingConfig.length > 0
                    ? "Setup needed"
                    : "Authorize Outlook"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Connector filters">
          {connectorFilters.map((filter) => {
            const isActive = connectorFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(filter)}
                className={cn(
                  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                  isActive
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-teal-200 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                )}
              >
                <span>{filter}</span>
                <span
                  className={cn(
                    "rounded-[999px] px-1.5 py-0.5 text-[10px]",
                    isActive ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                  )}
                >
                  {connectorFilterCount(filter)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {filteredConnectors.map((connector) => {
          const Icon = connector.icon;
          const isSelected = selectedConnector?.id === connector.id;

          return (
            <button
              key={connector.id}
              type="button"
              data-connector-card={connector.apiConnectorId}
              data-connector-id={connector.id}
              onClick={() => onSelectConnector(connector.id)}
              className={cn(
                "w-full cursor-pointer rounded-[8px] border px-3 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600",
                isSelected
                  ? "border-teal-300 bg-white shadow-sm"
                  : "border-teal-100 bg-white hover:border-teal-300 hover:bg-teal-50"
              )}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-teal-50 text-teal-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-teal-950">
                        {connector.name}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-4 text-teal-700">
                        {connector.category} / {connector.provider}
                      </span>
                    </span>
                    <ConnectorPermissionPill state={connector.permissionState} />
                  </span>
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-700">
                    {connector.description}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <ConnectorRiskPill riskLevel={connector.riskLevel} />
                    <span className="inline-flex min-w-0 items-center gap-1 rounded-[999px] bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{connector.status}</span>
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedConnector ? (
        <div className="mt-3 border-t border-teal-100 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-teal-700">
                {selectedConnector.category} connector
              </div>
              <div className="mt-1 break-words text-sm font-semibold text-teal-950">
                {selectedConnector.name}
              </div>
              <div className="mt-1 break-words text-xs leading-5 text-teal-700">
                {selectedConnector.lastSyncLabel}
              </div>
            </div>
            <ConnectorRiskPill riskLevel={selectedConnector.riskLevel} />
          </div>

          <div className="mt-3 grid gap-2">
            <StatusRow
              label="Permission state"
              value={selectedConnector.permissionState}
            />
            <StatusRow label="Provider" value={selectedConnector.provider} />
            <StatusRow label="Catalog status" value={selectedConnector.status} />
          </div>

          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
              <ShieldCheck className="size-4 text-teal-700" aria-hidden="true" />
              Available Actions
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedConnector.availableActions.map((action) => (
                <span
                  key={`${selectedConnector.id}-${action}`}
                  className="max-w-full rounded-[999px] bg-white px-2 py-0.5 text-[11px] font-medium text-teal-700"
                >
                  <span className="break-words">{action}</span>
                </span>
              ))}
            </div>
          </div>

          <div
            className="mt-3 rounded-[8px] border border-cyan-200 bg-cyan-50 px-3 py-3"
            data-approval-preview-panel
            data-api-connector-id={connectorPreviewPanel.connectorId}
            data-connector-action-preview={connectorPreviewPanel.action}
            data-connector-preview-source={connectorPreviewPanel.source}
            data-connector-preview-sync-status={connectorPreviewPanel.syncStatus}
            data-connector-preview-status={selectedConnectorPreviewStatus}
            data-connector-preview-only={String(connectorPreviewPanel.previewOnly)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-950">
                  <ShieldCheck
                    className="size-4 shrink-0 text-cyan-700"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    Tool Call Preview / Preview Only
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-cyan-800">
                  POST /api/daily/connectors/
                  {connectorPreviewPanel.connectorId}/preview -{" "}
                  {connectorPreviewPanel.action}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-cyan-700">
                  Source: {connectorPreviewPanel.source} - Status:{" "}
                  {connectorPreviewPanel.syncStatus}
                </p>
              </div>
              <StatusPill status={selectedConnectorPreviewStatus} />
            </div>

            <div className="mt-3 grid gap-2">
              <StatusRow
                label="Related context"
                value={
                  connectorPreviewPanel.relatedContextItemIds.length > 0
                    ? connectorPreviewPanel.relatedContextItemIds.join(", ")
                    : "No extra context required"
                }
              />
              <StatusRow
                label="Approval requests"
                value={
                  connectorPreviewPanel.requiredApprovalRequestIds.length > 0
                    ? connectorPreviewPanel.requiredApprovalRequestIds.join(", ")
                    : "No approval required"
                }
              />
            </div>

            <div
              className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-900"
              data-connector-preview-summary
            >
              {connectorPreviewPanel.summary}
            </div>

            <div className="mt-3 space-y-1">
              {connectorPreviewPanel.steps.map((step) => (
                <div
                  key={`${connectorPreviewPanel.connectorId}-${step}`}
                  className="flex items-start gap-2 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
                  data-connector-preview-step
                >
                  <CheckCircle2
                    className="mt-0.5 size-3.5 shrink-0 text-cyan-700"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{step}</span>
                </div>
              ))}
            </div>

            {selectedConnectorApprovalRequests.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedConnectorApprovalRequests.map((request) => (
                  <div
                    key={`${selectedConnector.id}-${request.id}`}
                    className="flex items-center justify-between gap-3 rounded-[8px] border border-cyan-100 bg-white px-2.5 py-2"
                    data-approval-preview-request={request.id}
                    data-approval-preview-status={request.status}
                  >
                    <span className="min-w-0 break-words text-xs font-medium text-cyan-950">
                      {request.title}
                    </span>
                    <StatusPill status={request.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
                This connector currently exposes public preview prompts only, so
                no approval is required before generating a local access prompt.
              </p>
            )}

            <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
              {connectorPreviewPanel.safetyStatement}
            </div>

            <div className="mt-3 rounded-[8px] border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-cyan-800">
              {connectorPreviewPanel.notice}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedConnector.requiredApprovalIds.length === 0}
                data-approval-decision-action="allow_once"
                data-approval-decision-target={selectedConnector.id}
                className="h-8 rounded-[8px] border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-50"
                onClick={() => {
                  onUpdateConnectorPreviewDecision(
                    selectedConnector,
                    "allowed_once"
                  );
                }}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Approve preview
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedConnector.requiredApprovalIds.length === 0}
                data-approval-decision-action="deny"
                data-approval-decision-target={selectedConnector.id}
                className="h-8 rounded-[8px] border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  onUpdateConnectorPreviewDecision(selectedConnector, "denied");
                }}
              >
                <Square className="size-4" aria-hidden="true" />
                Deny preview
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-[8px] border border-teal-100 bg-white px-3 py-2">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-teal-950">
              <AlertCircle className="size-4 text-orange-600" aria-hidden="true" />
              Next Setup Notes
            </div>
            <ul className="space-y-1">
              {selectedConnector.notes.map((note) => (
                <li
                  key={`${selectedConnector.id}-${note}`}
                  className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                >
                  <CheckCircle2
                    className="mt-0.5 size-3.5 shrink-0 text-teal-700"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="button"
            size="sm"
            className="mt-3 w-full bg-orange-500 hover:bg-orange-600"
            onClick={() => onApplyConnectorPrompt(selectedConnector)}
          >
            <Send className="size-4" aria-hidden="true" />
            Fill Access Prompt
          </Button>
          <p className="mt-2 text-xs leading-5 text-teal-700">
            This action only fills the assistant input. It does not authorize,
            sign in, or call external services.
          </p>
        </div>
      ) : null}
    </div>
  );
}
