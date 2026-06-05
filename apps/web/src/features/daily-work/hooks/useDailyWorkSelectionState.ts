"use client";

import { useMemo, useState } from "react";

import {
  activityEvents,
  artifacts,
  connectorItems,
  connectorMatchesFilter,
  connectorPreviewApprovalStatus,
  sessionHistoryItems,
  workflowActions
} from "../domain";
import type {
  ActivityEventItem,
  ApprovalRequestItem,
  ArtifactFilter,
  ArtifactItem,
  ConnectorFilter,
  ContextItem,
  ModelRouteMode,
  SessionHistoryFilter,
  SessionHistoryItem,
  WorkflowActionFilter
} from "../types";

export function useDailyWorkSelectionState() {
  const [sessionHistoryFilter, setSessionHistoryFilter] =
    useState<SessionHistoryFilter>("全部");
  const [selectedSessionHistoryId, setSelectedSessionHistoryId] = useState<
    string | null
  >(sessionHistoryItems[0]?.id ?? null);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState<ConnectorFilter>("全部");
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    connectorItems[0]?.id ?? null
  );
  const [workflowActionFilter, setWorkflowActionFilter] =
    useState<WorkflowActionFilter>("全部");
  const [selectedWorkflowActionId, setSelectedWorkflowActionId] = useState<
    string | null
  >(workflowActions[0]?.id ?? null);
  const [selectedActivityEventId, setSelectedActivityEventId] = useState<
    string | null
  >(activityEvents[0]?.id ?? null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    artifacts[0]?.id ?? null
  );
  const [artifactFilter, setArtifactFilter] = useState<ArtifactFilter>("全部");
  const [modelRouteMode, setModelRouteMode] = useState<ModelRouteMode>("fast");

  return {
    artifactFilter,
    connectorFilter,
    modelRouteMode,
    selectedActivityEventId,
    selectedArtifactId,
    selectedConnectorId,
    selectedContextId,
    selectedSessionHistoryId,
    selectedWorkflowActionId,
    sessionHistoryFilter,
    setArtifactFilter,
    setConnectorFilter,
    setModelRouteMode,
    setSelectedActivityEventId,
    setSelectedArtifactId,
    setSelectedConnectorId,
    setSelectedContextId,
    setSelectedSessionHistoryId,
    setSelectedWorkflowActionId,
    setSessionHistoryFilter,
    setWorkflowActionFilter,
    workflowActionFilter
  };
}

interface UseDailyWorkDerivedSelectionsOptions
  extends ReturnType<typeof useDailyWorkSelectionState> {
  activityFeedEvents: ActivityEventItem[];
  approvalRequests: ApprovalRequestItem[];
  artifactItems: ArtifactItem[];
  contextPanelItems: ContextItem[];
  sessionHistoryPanelItems: SessionHistoryItem[];
}

export function useDailyWorkDerivedSelections({
  activityFeedEvents,
  approvalRequests,
  artifactFilter,
  artifactItems,
  connectorFilter,
  contextPanelItems,
  selectedActivityEventId,
  selectedArtifactId,
  selectedConnectorId,
  selectedContextId,
  selectedSessionHistoryId,
  selectedWorkflowActionId,
  sessionHistoryFilter,
  sessionHistoryPanelItems,
  workflowActionFilter
}: UseDailyWorkDerivedSelectionsOptions) {
  const selectedContextItem = useMemo(
    () =>
      contextPanelItems.find((item) => item.id === selectedContextId) ?? null,
    [contextPanelItems, selectedContextId]
  );
  const filteredConnectors = useMemo(
    () =>
      connectorFilter === "全部"
        ? connectorItems
        : connectorItems.filter((item) =>
            connectorMatchesFilter(item, connectorFilter)
          ),
    [connectorFilter]
  );
  const selectedConnector = useMemo(() => {
    const selectedInFilter = filteredConnectors.find(
      (connector) => connector.id === selectedConnectorId
    );

    return selectedInFilter ?? filteredConnectors[0] ?? connectorItems[0] ?? null;
  }, [filteredConnectors, selectedConnectorId]);
  const selectedConnectorApprovalRequests = useMemo(() => {
    if (!selectedConnector) {
      return [];
    }

    return approvalRequests.filter((request) =>
      selectedConnector.requiredApprovalIds.includes(request.id)
    );
  }, [approvalRequests, selectedConnector]);
  const selectedConnectorPreviewStatus = useMemo(
    () =>
      connectorPreviewApprovalStatus(
        selectedConnector,
        selectedConnectorApprovalRequests
      ),
    [selectedConnector, selectedConnectorApprovalRequests]
  );
  const filteredWorkflowActions = useMemo(
    () =>
      workflowActionFilter === "全部"
        ? workflowActions
        : workflowActions.filter(
            (item) => item.approvalStatus === workflowActionFilter
          ),
    [workflowActionFilter]
  );
  const selectedWorkflowAction = useMemo(() => {
    const selectedInFilter = filteredWorkflowActions.find(
      (item) => item.id === selectedWorkflowActionId
    );

    return selectedInFilter ?? filteredWorkflowActions[0] ?? workflowActions[0] ?? null;
  }, [filteredWorkflowActions, selectedWorkflowActionId]);
  const selectedActivityEvent = useMemo(
    () =>
      activityFeedEvents.find((event) => event.id === selectedActivityEventId) ??
      activityFeedEvents[0] ??
      null,
    [activityFeedEvents, selectedActivityEventId]
  );
  const filteredArtifacts = useMemo(
    () =>
      artifactFilter === "全部"
        ? artifactItems
        : artifactItems.filter((artifact) => artifact.state === artifactFilter),
    [artifactFilter, artifactItems]
  );
  const selectedArtifact = useMemo(() => {
    const selectedInFilter = filteredArtifacts.find(
      (artifact) => artifact.id === selectedArtifactId
    );

    return selectedInFilter ?? filteredArtifacts[0] ?? artifactItems[0] ?? null;
  }, [artifactItems, filteredArtifacts, selectedArtifactId]);
  const filteredSessionHistory = useMemo(
    () =>
      sessionHistoryFilter === "全部"
        ? sessionHistoryPanelItems
        : sessionHistoryPanelItems.filter(
            (item) => item.status === sessionHistoryFilter
          ),
    [sessionHistoryFilter, sessionHistoryPanelItems]
  );
  const selectedSessionHistory = useMemo(() => {
    const selectedInFilter = filteredSessionHistory.find(
      (item) => item.id === selectedSessionHistoryId
    );

    return selectedInFilter ?? filteredSessionHistory[0] ?? sessionHistoryPanelItems[0] ?? null;
  }, [filteredSessionHistory, selectedSessionHistoryId, sessionHistoryPanelItems]);

  return {
    filteredArtifacts,
    filteredConnectors,
    filteredSessionHistory,
    filteredWorkflowActions,
    selectedActivityEvent,
    selectedArtifact,
    selectedConnector,
    selectedConnectorApprovalRequests,
    selectedConnectorPreviewStatus,
    selectedContextItem,
    selectedSessionHistory,
    selectedWorkflowAction
  };
}
