import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import type { Despesa } from './types'
import { limitesDoMes } from './format'

const BUCKET = 'comprovantes'

/** Busca despesas entre duas datas (inclusive), opcionalmente por categoria. */
export async function buscarDespesas(ini: string, fim: string, categoria?: string): Promise<Despesa[]> {
  let q = supabase.from('despesas').select('*').gte('data_despesa', ini).lte('data_despesa', fim)
    .order('data_despesa', { ascending: false })
  if (categoria) q = q.eq('categoria', categoria)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Despesa[]
}

export const buscarPorMes = (ym: string, categoria?: string) => {
  const { ini, fim } = limitesDoMes(ym)
  return buscarDespesas(ini, fim, categoria)
}

/**
 * Prepara o anexo: imagens são comprimidas (máx. 1 MB / 1280 px) e convertidas para JPEG.
 * PDFs e formatos que o navegador não decodifica (ex.: HEIC) seguem como estão.
 */
export async function prepararArquivo(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith('image/')) return arquivo
  try {
    const blob = await imageCompression(arquivo, {
      maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true, fileType: 'image/jpeg',
    })
    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nome, { type: 'image/jpeg' })
  } catch (e) {
    console.warn('Falha ao comprimir; usando o original.', e)
    return arquivo
  }
}

/** Envia o arquivo (já preparado) ao bucket; retorna o path salvo. */
export async function enviarComprovante(f: File): Promise<string> {
  const nome = f.name.replace(/[^\w.\-]/g, '_')
  const path = `${Date.now()}-${nome}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type })
  if (error) throw error
  return path
}

export async function criarDespesa(d: Omit<Despesa, 'id' | 'created_at'>) {
  const { error } = await supabase.from('despesas').insert(d)
  if (error) {
    // Não deixa arquivo órfão no bucket se o registro não foi salvo
    if (d.comprovante_url) await supabase.storage.from(BUCKET).remove([d.comprovante_url])
    throw error
  }
}

/** URL assinada válida por 60 segundos. */
export async function urlComprovante(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

/** Remove o registro e o arquivo do Storage. */
export async function excluirDespesa(d: Despesa) {
  const { error } = await supabase.from('despesas').delete().eq('id', d.id)
  if (error) throw error
  if (d.comprovante_url) {
    const { error: errArq } = await supabase.storage.from(BUCKET).remove([d.comprovante_url])
    if (errArq) console.error('Registro excluído, mas o anexo não foi removido:', errArq)
  }
}
