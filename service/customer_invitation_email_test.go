package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSendCustomerInvitationEmailSkipsWhenNoEmail(t *testing.T) {
	sent, err := SendCustomerInvitationEmail(&model.CustomerInvitation{
		Token: "abc",
		Email: "",
	}, "Acme")
	require.NoError(t, err)
	require.False(t, sent)
}

func TestSendCustomerInvitationEmailSkipsWhenSMTPUnset(t *testing.T) {
	sent, err := SendCustomerInvitationEmail(&model.CustomerInvitation{
		Token: "abc",
		Email: "invitee@example.com",
	}, "Acme")
	require.NoError(t, err)
	require.False(t, sent)
}
