/*
Copyright (C) 2023-2026 QuantumNous
*/
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/stretchr/testify/require"
)

func TestInitTaskCopiesUpstreamSource(t *testing.T) {
	info := &relaycommon.RelayInfo{
		UserId:         42,
		UsingGroup:     "default",
		UpstreamSource: UpstreamSourceByok,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:   9,
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
	task := InitTask(constant.TaskPlatformSuno, info)
	require.NotNil(t, task)
	require.Equal(t, UpstreamSourceByok, task.UpstreamSource)
	require.Equal(t, 9, task.ChannelId)
	require.Equal(t, 42, task.UserId)
}

func TestInitTaskEmptyUpstreamSource(t *testing.T) {
	info := &relaycommon.RelayInfo{
		UserId: 1,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:   2,
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
	task := InitTask(constant.TaskPlatformSuno, info)
	require.NotNil(t, task)
	require.Equal(t, "", task.UpstreamSource)
	require.Equal(t, 2, task.ChannelId)
}

func TestMidjourneyUpstreamSourcePersists(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Midjourney{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM midjourneys WHERE mj_id = ?", "mj-byok-1")
	})
	DB.Exec("DELETE FROM midjourneys WHERE mj_id = ?", "mj-byok-1")

	mj := &Midjourney{
		UserId:         7,
		MjId:           "mj-byok-1",
		Action:         "IMAGINE",
		ChannelId:      3,
		UpstreamSource: UpstreamSourceDedicated,
		Progress:       "0%",
	}
	require.NoError(t, mj.Insert())

	loaded := GetByOnlyMJId("mj-byok-1")
	require.NotNil(t, loaded)
	require.Equal(t, UpstreamSourceDedicated, loaded.UpstreamSource)
	require.Equal(t, 3, loaded.ChannelId)
}

func TestTaskUpstreamSourcePersists(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:         "task-byok-1",
		UserId:         8,
		ChannelId:      4,
		UpstreamSource: UpstreamSourceByok,
		Platform:       constant.TaskPlatformSuno,
		Status:         TaskStatusSubmitted,
		Progress:       "0%",
	}
	require.NoError(t, task.Insert())

	loaded, ok, err := GetByTaskId(8, "task-byok-1")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, loaded)
	require.Equal(t, UpstreamSourceByok, loaded.UpstreamSource)
}
