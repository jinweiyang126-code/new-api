package controller

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestExtractOpenRouterStyleModels_DirectAndEnvelope(t *testing.T) {
	direct := []byte(`{"data":[{"id":"gpt-4o","pricing":{"prompt":"0.000002","completion":"0.000008"}}]}`)
	models, err := extractOpenRouterStyleModels(direct)
	require.NoError(t, err)
	require.Len(t, models, 1)
	require.Equal(t, "gpt-4o", models[0].ID)

	envelope := []byte(`{"code":0,"message":"success","data":[{"id":"seedream-4.5","pricing":{"request":"0.04"}}]}`)
	models, err = extractOpenRouterStyleModels(envelope)
	require.NoError(t, err)
	require.Len(t, models, 1)
	require.Equal(t, "seedream-4.5", models[0].ID)
}

func TestConvertOpenRouterStyleModelsToRatioData_TokenAndFixed(t *testing.T) {
	models := []openRouterStyleModel{
		{
			ID: "gpt-4o",
			Pricing: openRouterStylePricing{
				Prompt:     []byte(`"0.000002"`),
				Completion: []byte(`"0.000008"`),
			},
		},
		{
			ID: "seedream-4.5",
			Pricing: openRouterStylePricing{
				Request: []byte(`0.04`),
			},
		},
	}

	converted := convertOpenRouterStyleModelsToRatioData(models)
	require.Contains(t, converted, "model_ratio")
	require.Contains(t, converted, "completion_ratio")
	require.Contains(t, converted, "model_price")

	ratios := converted["model_ratio"].(map[string]any)
	require.InDelta(t, 1.0, ratios["gpt-4o"].(float64), 1e-9)

	comps := converted["completion_ratio"].(map[string]any)
	require.InDelta(t, 4.0, comps["gpt-4o"].(float64), 1e-9)

	prices := converted["model_price"].(map[string]any)
	require.InDelta(t, 0.04, prices["seedream-4.5"].(float64), 1e-9)
}

func TestConvertOpenRouterStyleModelsToRatioData_NoPricing(t *testing.T) {
	converted := convertOpenRouterStyleModelsToRatioData([]openRouterStyleModel{
		{ID: "no-price"},
	})
	require.Empty(t, converted)
}

func TestFetchAndConvertBasicRouterRatios_UsesModelsEndpoints(t *testing.T) {
	var sawAuth bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer test-key" {
			sawAuth = true
		}
		switch r.URL.Path {
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o","pricing":{"prompt":"0.000002","completion":"0.000008"}}]}`))
		case "/v1/image-models":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":"seedream-4.5","pricing":{"request":0.04}}]}`))
		case "/v1/video-models":
			_, _ = w.Write([]byte(`{"data":[{"id":"seedance-2.0","pricing":{"request":"0.2"}}]}`))
		case "/api/pricing":
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	converted, err := fetchAndConvertBasicRouterRatios(ctx, server.Client(), server.URL, "test-key")
	require.NoError(t, err)
	require.True(t, sawAuth)
	require.Contains(t, converted["model_ratio"].(map[string]any), "gpt-4o")
	require.Contains(t, converted["model_price"].(map[string]any), "seedream-4.5")
	require.Contains(t, converted["model_price"].(map[string]any), "seedance-2.0")
}

func TestFetchAndConvertBasicRouterRatios_NoPricingFields(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"model-a"},{"id":"model-b"}]}`))
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := fetchAndConvertBasicRouterRatios(ctx, server.Client(), server.URL, "test-key")
	require.Error(t, err)
	require.Contains(t, err.Error(), "未包含可用单价")
}

func TestConvertOpenRouterToRatioData_StillWorks(t *testing.T) {
	body := `{"data":[{"id":"openai/gpt-4o","pricing":{"prompt":"0.000002","completion":"0.000008","input_cache_read":"0.000001"}}]}`
	converted, err := convertOpenRouterToRatioData(bytes.NewReader([]byte(body)))
	require.NoError(t, err)
	require.Contains(t, converted, "model_ratio")
	require.Contains(t, converted, "cache_ratio")
}
