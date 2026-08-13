package service

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// SendCustomerInvitationEmail emails the accept link when SMTP is configured.
// Returns (sent=false, err=nil) when email is empty or SMTP is not configured.
func SendCustomerInvitationEmail(inv *model.CustomerInvitation, customerName string) (sent bool, err error) {
	if inv == nil {
		return false, nil
	}
	email := model.NormalizeEmail(inv.Email)
	if email == "" {
		return false, nil
	}
	if common.SMTPServer == "" && common.SMTPAccount == "" {
		return false, nil
	}

	base := strings.TrimRight(system_setting.ServerAddress, "/")
	if base == "" {
		base = "http://localhost:3000"
	}
	link := fmt.Sprintf("%s/invitations/accept?token=%s", base, url.QueryEscape(inv.Token))

	name := strings.TrimSpace(customerName)
	if name == "" {
		name = "organization"
	}

	expiresHint := ""
	if inv.ExpiresAt > 0 {
		expiresHint = fmt.Sprintf(
			"<p>本邀请有效期至：<strong>%s</strong></p>",
			time.Unix(inv.ExpiresAt, 0).Local().Format("2006-01-02 15:04"),
		)
	}

	subject := fmt.Sprintf("%s — 邀请加入 %s", common.SystemName, name)
	content := fmt.Sprintf(
		"<p>您好，</p>"+
			"<p>您被邀请加入 <strong>%s</strong>（%s）。</p>"+
			"<p>请先登录或注册账号，然后点击下方链接接受邀请：</p>"+
			"<p><a href='%s'>接受邀请</a></p>"+
			"<p>如果链接无法点击，请将以下地址复制到浏览器打开：<br>%s</p>"+
			"%s"+
			"<p>如非本人操作，请忽略本邮件。</p>",
		name, common.SystemName, link, link, expiresHint,
	)

	if err := common.SendEmail(subject, email, content); err != nil {
		return false, err
	}
	return true, nil
}
