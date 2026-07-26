import http.client
import json
import time

print('=== Análise de ativos ===\n')

# Assets that should be available from the API\nassets_to_test = [
    'BTCUSD', 'ETHUSD', 'LINKUSD', 'SOLUSD',
    'AVAXUSD', 'SANDUSD', 'USDTUSD', 'WBTCUSD',
    'PEPEUSD', 'FLOKIUSD', 'BABYDOGEUSD'
]

results = []

for asset in assets_to_test:
    print(f'Testando {asset}...')
    conn = http.client.HTTPConnection('127.0.0.1', 3001)
    body = json.dumps({
        'asset': asset,
        'direction': 'CALL',
        'amount': 10,
        'expiration': 60,
        'entryPrice': 50000.0,
        'isDemo': True
    })
    conn.request('POST', '/trades', body, {'Content-Type': 'application/json'})
    resp = conn.getresponse()
    error_body = resp.read().decode()

    status = 'success' if resp.status == 200 else 'error'
    error_type = 'unknown'

    if resp.status == 200:
        data = json.loads(error_body)
        results.append({
            'asset': asset,
            'status': 'SUCCESS',
            'order_id': data.get('id'),
            'direction': 'CALL',
            'expiration': 60,
            'entry_price': 50000.0,
            'market_status': 'OPEN_AND_ACCEPTING_ORDERS'
        })
    else:
        error_info = {}
        if 'CANDLE_TIME' in error_body:
            error_info['type'] = 'CANDLE_TIME_REJECTED'
            error_info['market_status'] = 'OPEN_BUT_WRONG_TRADING_MODE'
        elif 'Mercado fechado' in error_body:
            error_info['type'] = 'MARKET_CLOSED'
            error_info['market_status'] = 'CLOSED'
        else:
            error_info['type'] = 'OTHER_ERROR'
            error_info['market_status'] = 'ERROR_UNKNOWN'

        results.append({
            'asset': asset,
            'status': 'ERROR',
            'error_type': error_info['type'],
            'market_status': error_info['market_status'],
            'direction': 'CALL',
            'expiration': 60,
            'entry_price': 50000.0
        })

    conn.close()
    time.sleep(0.3)

print('=== RESUMO ===')
print(f'Total de ativos testados: {len(assets_to_test)}')
print()

status_summary = {}
for result in results:
    asset_status = result['status']
    if asset_status not in status_summary:
        status_summary[asset_status] = {'count': 0, 'assets': []}
    status_summary[asset_status]['count'] += 1
    status_summary[asset_status]['assets'].append(result['asset'])

for status, data in status_summary.items():
    if status == 'SUCCESS':
        icon = '✅'
    else:
        icon = '❌'
    print(f'{icon}  {status}: {data["count"]} ativos')
    if status == 'SUCCESS':
        print(f'   {data["assets"]}')

print('\n=== ESTADO DO MERCADO ===')
open_and_accepting = [r for r in results if r.get('market_status') == 'OPEN_AND_ACCEPTING_ORDERS']
open_but_wrong_mode = [r for r in results if r.get('market_status') == 'OPEN_BUT_WRONG_TRADING_MODE']
closed_market = [r for r in results if r.get('market_status') == 'CLOSED']
other_error = [r for r in results if r.get('market_status') == 'ERROR_UNKNOWN']

if open_and_accepting:
    print(f'\n🎯 Abertos e aceitando ordens:')
    for r in open_and_accepting:
        print(f'   • {r["asset"]}')

if open_but_wrong_mode:
    print(f'\n⚠  Abertos mas modo CANDLE_TIME rejeitado:')
    for r in open_but_wrong_mode:
        print(f'   • {r["asset"]}')

if closed_market:
    print(f'\n❌  Fechados (Market closed):')
    for r in closed_market:
        print(f'   • {r["asset"]}')

if other_error:
    print(f'\n❓  Erros desconhecidos:')
    for r in other_error:
        print(f'   • {r["asset"]}')

print('\n=== RECOMENDAÇÕES ===')
if open_and_accepting:
    print('✅ Ordens CANDLE_TIME podem ser enviadas para:')
    for r in open_and_accepting:
        print(f'   • {r["asset"]}')

if open_but_wrong_mode:
    print('\n⚠ Ordens NEXT_CANDLE ou RUNNING_TIME podem ser aplicadas para:')
    for r in open_but_wrong_mode:
        print(f'   • {r["asset"]}')

if not open_and_accepting and not open_but_wrong_mode:
    print('\n⚠️  Nenhum ativo está aceitando ordens. Pode ser devido a:\n   • Horário de mercado fora do normal\n   • Manutenção agendada\n   • Configurações de trading restritas')
