import * as React from "react";

import * as domain from "../domain";
import type * as DailyWorkTypes from "../types";

export function useActivityFeed(
  apiBaseUrl: string,
  setSelectedActivityEventId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const [activityFeedEvents, setActivityFeedEvents] =
    React.useState<DailyWorkTypes.ActivityEventItem[]>(domain.activityEvents);
  const [activityFeedSource, setActivityFeedSource] =
    React.useState<DailyWorkTypes.ActivityFeedSource>("fallback");
  const [activityConnectionStatus, setActivityConnectionStatus] =
    React.useState<DailyWorkTypes.ActivityConnectionStatus>("connecting");
  const [activityLastUpdated, setActivityLastUpdated] =
    React.useState("鍓嶇 fallback 绀轰緥");
  const [activityFeedNotice, setActivityFeedNotice] = React.useState(
    "Connecting to the backend activity feed; showing frontend fallback data for now."
  );

  React.useEffect(() => {
    let isDisposed = false;
    const controller = new AbortController();

    const applySnapshot = (
      payload: DailyWorkTypes.DailyActivitySnapshotDto,
      source: Exclude<DailyWorkTypes.ActivityFeedSource, "fallback">
    ) => {
      const nextEvents = domain.mapDailyActivitySnapshot(payload);

      if (isDisposed || nextEvents.length === 0) {
        return;
      }

      setActivityFeedEvents(nextEvents);
      setActivityFeedSource(source);
      setActivityLastUpdated(domain.formatActivityUpdatedAt(new Date()));
      setActivityFeedNotice(
        source === "websocket"
          ? "已从 WebSocket 收到 daily.activity.snapshot，活动流保持实时同步。"
          : "已从 /api/daily/events?mode=daily_work 同步活动流。"
      );
      setSelectedActivityEventId((currentId) =>
        nextEvents.some((event) => event.id === currentId)
          ? currentId
          : nextEvents[0]?.id ?? null
      );
    };

    async function fetchActivityEvents() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/daily/events?mode=${domain.activeMode}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Activity events request failed: ${response.status}`);
        }

        applySnapshot((await response.json()) as DailyWorkTypes.DailyActivitySnapshotDto, "api");
      } catch {
        if (controller.signal.aborted || isDisposed) {
          return;
        }

        setActivityConnectionStatus("degraded");
        setActivityFeedNotice(
          "暂未取到后端活动列表，页面会继续保留前端 fallback 示例。"
        );
      }
    }

    function connectActivitySocket() {
      const socketUrl = domain.getRuntimeWebSocketUrl(apiBaseUrl);

      if (!socketUrl) {
        setActivityConnectionStatus("degraded");
        setActivityFeedNotice("WebSocket 地址不可用，活动流继续使用当前快照。");
        return undefined;
      }

      const socket = new WebSocket(socketUrl);

      socket.addEventListener("open", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("live");
        }
      });

      socket.addEventListener("message", (event) => {
        const payload = domain.parseDailyActivitySnapshot(event.data);

        if (payload?.type === "daily.activity.snapshot") {
          applySnapshot(payload, "websocket");
        }
      });

      socket.addEventListener("error", () => {
        if (!isDisposed) {
          setActivityConnectionStatus("degraded");
          setActivityFeedNotice("WebSocket 连接失败，活动流继续使用当前快照。");
        }
      });

      socket.addEventListener("close", () => {
        if (!isDisposed) {
          setActivityConnectionStatus((currentStatus) =>
            currentStatus === "live" ? "closed" : "degraded"
          );
        }
      });

      return socket;
    }

    setActivityConnectionStatus("connecting");
    void fetchActivityEvents();
    const socket = connectActivitySocket();

    return () => {
      isDisposed = true;
      controller.abort();
      socket?.close();
    };
  }, [apiBaseUrl])

  return {
    activityConnectionStatus,
    activityFeedEvents,
    activityFeedNotice,
    activityFeedSource,
    activityLastUpdated
  };
}
