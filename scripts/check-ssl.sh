#!/bin/bash

# SsalgTen SSL 证书检查工具
# 使用方法: ./check-ssl.sh [domain]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 SsalgTen SSL 证书检查工具${NC}"
echo "=================================="

# 获取域名参数
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}请提供域名参数${NC}"
    echo "使用方法: ./check-ssl.sh your-domain.com"
    exit 1
fi

DOMAIN=$1

echo -e "${BLUE}📋 检查域名: $DOMAIN${NC}"
echo ""

# 检查域名解析
check_dns() {
    echo -e "${BLUE}🔍 检查 DNS 解析...${NC}"
    
    if command -v dig >/dev/null 2>&1; then
        A_RECORD=$(dig +short A $DOMAIN)
        AAAA_RECORD=$(dig +short AAAA $DOMAIN)
        
        if [ -n "$A_RECORD" ]; then
            echo -e "${GREEN}✅ A 记录: $A_RECORD${NC}"
        else
            echo -e "${RED}❌ 未找到 A 记录${NC}"
            return 1
        fi
        
        if [ -n "$AAAA_RECORD" ]; then
            echo -e "${GREEN}✅ AAAA 记录: $AAAA_RECORD${NC}"
        else
            echo -e "${YELLOW}⚠️  未找到 AAAA 记录 (IPv6)${NC}"
        fi
        
    elif command -v nslookup >/dev/null 2>&1; then
        if nslookup $DOMAIN >/dev/null 2>&1; then
            echo -e "${GREEN}✅ DNS 解析正常${NC}"
            nslookup $DOMAIN | grep "Address:" | head -3
        else
            echo -e "${RED}❌ DNS 解析失败${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  未找到 dig 或 nslookup 工具${NC}"
    fi
    
    echo ""
}

# 检查端口连通性
check_connectivity() {
    echo -e "${BLUE}🌐 检查端口连通性...${NC}"
    
    # 检查 HTTP (80)
    if timeout 5 bash -c "</dev/tcp/$DOMAIN/80" 2>/dev/null; then
        echo -e "${GREEN}✅ HTTP (80) 端口可达${NC}"
    else
        echo -e "${RED}❌ HTTP (80) 端口不可达${NC}"
    fi
    
    # 检查 HTTPS (443)
    if timeout 5 bash -c "</dev/tcp/$DOMAIN/443" 2>/dev/null; then
        echo -e "${GREEN}✅ HTTPS (443) 端口可达${NC}"
    else
        echo -e "${RED}❌ HTTPS (443) 端口不可达${NC}"
        return 1
    fi
    
    echo ""
}

# 检查 SSL 证书
check_ssl_certificate() {
    echo -e "${BLUE}🔒 检查 SSL 证书...${NC}"
    
    if command -v openssl >/dev/null 2>&1; then
        # 获取证书信息
        CERT_INFO=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -text 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            # 提取证书详细信息
            ISSUER=$(echo "$CERT_INFO" | grep "Issuer:" | sed 's/.*Issuer: //')
            SUBJECT=$(echo "$CERT_INFO" | grep "Subject:" | sed 's/.*Subject: //')
            NOT_BEFORE=$(echo "$CERT_INFO" | grep "Not Before:" | sed 's/.*Not Before: //')
            NOT_AFTER=$(echo "$CERT_INFO" | grep "Not After:" | sed 's/.*Not After: //')
            
            echo -e "${GREEN}✅ SSL 证书有效${NC}"
            echo "  颁发者: $ISSUER"
            echo "  主题: $SUBJECT"
            echo "  有效期: $NOT_BEFORE"
            echo "  到期时间: $NOT_AFTER"
            
            # 检查证书是否即将到期
            EXPIRY_DATE=$(date -d "$NOT_AFTER" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$NOT_AFTER" +%s 2>/dev/null)
            CURRENT_DATE=$(date +%s)
            DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_DATE - $CURRENT_DATE) / 86400 ))
            
            if [ $DAYS_UNTIL_EXPIRY -gt 30 ]; then
                echo -e "${GREEN}✅ 证书还有 $DAYS_UNTIL_EXPIRY 天到期${NC}"
            elif [ $DAYS_UNTIL_EXPIRY -gt 7 ]; then
                echo -e "${YELLOW}⚠️  证书将在 $DAYS_UNTIL_EXPIRY 天后到期${NC}"
            else
                echo -e "${RED}❌ 证书将在 $DAYS_UNTIL_EXPIRY 天后到期，请尽快续签${NC}"
            fi
            
        else
            echo -e "${RED}❌ 无法获取 SSL 证书信息${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  未找到 openssl 工具${NC}"
        return 1
    fi
    
    echo ""
}

# 测试 HTTPS 连接
test_https_connection() {
    echo -e "${BLUE}🔗 测试 HTTPS 连接...${NC}"
    
    if command -v curl >/dev/null 2>&1; then
        # 测试基本连接
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN --max-time 10)
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
            echo -e "${GREEN}✅ HTTPS 连接正常 (HTTP $HTTP_CODE)${NC}"
        else
            echo -e "${RED}❌ HTTPS 连接异常 (HTTP $HTTP_CODE)${NC}"
        fi
        
        # 测试 API 端点
        API_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/health --max-time 10)
        if [ "$API_CODE" = "200" ]; then
            echo -e "${GREEN}✅ API 端点正常 (/api/health)${NC}"
        else
            echo -e "${YELLOW}⚠️  API 端点异常 (/api/health - HTTP $API_CODE)${NC}"
        fi
        
        # 测试 WebSocket 端点
        WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/socket.io/ --max-time 10)
        if [ "$WS_CODE" = "200" ] || [ "$WS_CODE" = "400" ]; then
            echo -e "${GREEN}✅ WebSocket 端点正常 (/socket.io/)${NC}"
        else
            echo -e "${YELLOW}⚠️  WebSocket 端点异常 (/socket.io/ - HTTP $WS_CODE)${NC}"
        fi
        
    else
        echo -e "${YELLOW}⚠️  未找到 curl 工具${NC}"
    fi
    
    echo ""
}

# 检查反向代理配置
check_proxy_config() {
    echo -e "${BLUE}🔧 检查反向代理配置...${NC}"
    
    # 检查 Caddy
    if command -v caddy >/dev/null 2>&1; then
        if systemctl is-active --quiet caddy 2>/dev/null; then
            echo -e "${GREEN}✅ Caddy 服务运行中${NC}"
            
            # 检查 Caddy 配置
            if [ -f /etc/caddy/Caddyfile ]; then
                if grep -q "$DOMAIN" /etc/caddy/Caddyfile; then
                    echo -e "${GREEN}✅ Caddy 配置包含域名 $DOMAIN${NC}"
                else
                    echo -e "${YELLOW}⚠️  Caddy 配置中未找到域名 $DOMAIN${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  Caddy 服务未运行${NC}"
        fi
    fi
    
    # 检查 Nginx
    if command -v nginx >/dev/null 2>&1; then
        if systemctl is-active --quiet nginx 2>/dev/null; then
            echo -e "${GREEN}✅ Nginx 服务运行中${NC}"
            
            # 检查 Nginx 配置
            NGINX_CONF=$(find /etc/nginx -name "*.conf" -exec grep -l "$DOMAIN" {} \; 2>/dev/null | head -1)
            if [ -n "$NGINX_CONF" ]; then
                echo -e "${GREEN}✅ Nginx 配置包含域名 $DOMAIN${NC}"
                echo "  配置文件: $NGINX_CONF"
            else
                echo -e "${YELLOW}⚠️  Nginx 配置中未找到域名 $DOMAIN${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Nginx 服务未运行${NC}"
        fi
    fi
    
    echo ""
}

# 生成报告
generate_report() {
    echo -e "${BLUE}📊 生成检查报告...${NC}"
    
    REPORT_FILE="/tmp/ssl-check-$DOMAIN-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "SsalgTen SSL 证书检查报告"
        echo "=========================="
        echo "检查时间: $(date)"
        echo "检查域名: $DOMAIN"
        echo ""
        
        echo "=== DNS 解析 ==="
        if command -v dig >/dev/null 2>&1; then
            dig +short A $DOMAIN | sed 's/^/A记录: /'
            dig +short AAAA $DOMAIN | sed 's/^/AAAA记录: /'
        fi
        echo ""
        
        echo "=== SSL 证书信息 ==="
        if command -v openssl >/dev/null 2>&1; then
            echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -text 2>/dev/null | grep -A1 -B1 -E "(Issuer|Subject|Not Before|Not After)"
        fi
        echo ""
        
        echo "=== 连接测试结果 ==="
        if command -v curl >/dev/null 2>&1; then
            echo "主页: $(curl -s -o /dev/null -w "HTTP %{http_code}" https://$DOMAIN --max-time 10)"
            echo "API健康检查: $(curl -s -o /dev/null -w "HTTP %{http_code}" https://$DOMAIN/api/health --max-time 10)"
            echo "WebSocket: $(curl -s -o /dev/null -w "HTTP %{http_code}" https://$DOMAIN/socket.io/ --max-time 10)"
        fi
        
    } > "$REPORT_FILE"
    
    echo -e "${GREEN}✅ 报告已保存到: $REPORT_FILE${NC}"
}

# 主执行流程
main() {
    local all_checks_passed=true
    
    # 执行各项检查
    check_dns || all_checks_passed=false
    check_connectivity || all_checks_passed=false
    check_ssl_certificate || all_checks_passed=false
    test_https_connection
    check_proxy_config
    generate_report
    
    # 总结
    echo -e "${BLUE}📋 检查总结${NC}"
    echo "=================="
    
    if [ "$all_checks_passed" = true ]; then
        echo -e "${GREEN}🎉 所有关键检查都通过了！${NC}"
        echo -e "${GREEN}✅ 你的 HTTPS 配置看起来很健康${NC}"
    else
        echo -e "${RED}⚠️  发现一些问题需要关注${NC}"
        echo -e "${YELLOW}💡 建议检查上面的错误信息并进行相应修复${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔧 故障排查提示:${NC}"
    echo "1. DNS解析问题: 检查域名DNS设置"
    echo "2. 端口连通性问题: 检查防火墙和安全组"
    echo "3. SSL证书问题: 检查证书配置和有效期"
    echo "4. 反向代理问题: 检查 Caddy/Nginx 配置"
    
    return $([ "$all_checks_passed" = true ] && echo 0 || echo 1)
}

# 运行主程序
main