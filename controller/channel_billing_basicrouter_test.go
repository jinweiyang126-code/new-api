package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseBasicRouterBalanceDirect(t *testing.T) {
	credit, err := parseBasicRouterBalance([]byte(`{"totalCredit":128.5,"totalResourceCredit":30}`))
	require.NoError(t, err)
	require.Equal(t, 128.5, credit)
}

func TestParseBasicRouterBalanceEnvelope(t *testing.T) {
	credit, err := parseBasicRouterBalance([]byte(`{"code":0,"message":"success","data":{"totalCredit":"48.50","wallets":{"payAsYouGo":48.5}}}`))
	require.NoError(t, err)
	require.Equal(t, 48.5, credit)
}

func TestParseBasicRouterBalanceMissing(t *testing.T) {
	_, err := parseBasicRouterBalance([]byte(`{"code":500,"message":"unauthorized"}`))
	require.EqualError(t, err, "unauthorized")
}
