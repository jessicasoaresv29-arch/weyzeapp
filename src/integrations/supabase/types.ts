export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda: {
        Row: {
          created_at: string
          data: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacao: string | null
          prestador_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          prestador_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          prestador_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          cliente_id: string
          comentario: string | null
          contrato_id: string | null
          created_at: string
          id: string
          nota: number
          prestador_id: string
        }
        Insert: {
          cliente_id: string
          comentario?: string | null
          contrato_id?: string | null
          created_at?: string
          id?: string
          nota: number
          prestador_id: string
        }
        Update: {
          cliente_id?: string
          comentario?: string | null
          contrato_id?: string | null
          created_at?: string
          id?: string
          nota?: number
          prestador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_confirmations: {
        Row: {
          cliente_confirmou: boolean
          cliente_confirmou_at: string | null
          created_at: string
          id: string
          payment_id: string
          prestador_confirmou: boolean
          prestador_confirmou_at: string | null
          updated_at: string
        }
        Insert: {
          cliente_confirmou?: boolean
          cliente_confirmou_at?: string | null
          created_at?: string
          id?: string
          payment_id: string
          prestador_confirmou?: boolean
          prestador_confirmou_at?: string | null
          updated_at?: string
        }
        Update: {
          cliente_confirmou?: boolean
          cliente_confirmou_at?: string | null
          created_at?: string
          id?: string
          payment_id?: string
          prestador_confirmou?: boolean
          prestador_confirmou_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_confirmations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      contratos: {
        Row: {
          cliente_id: string
          created_at: string
          data_final: string | null
          data_inicio: string
          id: string
          prestador_id: string
          proposta_id: string | null
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["status_contrato"]
          updated_at: string
          valor_final: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_final?: string | null
          data_inicio?: string
          id?: string
          prestador_id: string
          proposta_id?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          updated_at?: string
          valor_final?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_final?: string | null
          data_inicio?: string
          id?: string
          prestador_id?: string
          proposta_id?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["status_contrato"]
          updated_at?: string
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          prestador_id: string
          solicitacao_id: string | null
          status_negociacao: string
          ultima_mensagem_at: string | null
          ultima_mensagem_texto: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          prestador_id: string
          solicitacao_id?: string | null
          status_negociacao?: string
          ultima_mensagem_at?: string | null
          ultima_mensagem_texto?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          prestador_id?: string
          solicitacao_id?: string | null
          status_negociacao?: string
          ultima_mensagem_at?: string | null
          ultima_mensagem_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          observacao: string | null
          prestador_id: string
          status: Database["public"]["Enums"]["status_documento"]
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          observacao?: string | null
          prestador_id: string
          status?: Database["public"]["Enums"]["status_documento"]
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          observacao?: string | null
          prestador_id?: string
          status?: Database["public"]["Enums"]["status_documento"]
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          prestador_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          prestador_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          prestador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          arquivo_url: string | null
          conversa_id: string
          created_at: string
          id: string
          lida: boolean
          lida_at: string | null
          remetente_id: string
          texto: string | null
          tipo: string
        }
        Insert: {
          arquivo_url?: string | null
          conversa_id: string
          created_at?: string
          id?: string
          lida?: boolean
          lida_at?: string | null
          remetente_id: string
          texto?: string | null
          tipo?: string
        }
        Update: {
          arquivo_url?: string | null
          conversa_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          lida_at?: string | null
          remetente_id?: string
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_remetente_profile_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_test_payments: {
        Row: {
          created_at: string
          external_ref: string
          forma: string
          id: string
          init_point: string | null
          metadata: Json | null
          mp_payment_id: string | null
          pix_copia_cola: string | null
          pix_qr_base64: string | null
          preference_id: string | null
          status: string
          status_detail: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          external_ref: string
          forma: string
          id?: string
          init_point?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          pix_copia_cola?: string | null
          pix_qr_base64?: string | null
          preference_id?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          external_ref?: string
          forma?: string
          id?: string
          init_point?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          pix_copia_cola?: string | null
          pix_qr_base64?: string | null
          preference_id?: string | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      mp_webhook_log: {
        Row: {
          external_ref: string | null
          id: string
          mp_payment_id: string | null
          payload: Json | null
          received_at: string
          status: string | null
          status_detail: string | null
        }
        Insert: {
          external_ref?: string | null
          id?: string
          mp_payment_id?: string | null
          payload?: Json | null
          received_at?: string
          status?: string | null
          status_detail?: string | null
        }
        Update: {
          external_ref?: string | null
          id?: string
          mp_payment_id?: string | null
          payload?: Json | null
          received_at?: string
          status?: string | null
          status_detail?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_profile_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          ator: string | null
          created_at: string
          dados: Json | null
          evento: string
          id: string
          payment_id: string | null
        }
        Insert: {
          ator?: string | null
          created_at?: string
          dados?: Json | null
          evento: string
          id?: string
          payment_id?: string | null
        }
        Update: {
          ator?: string | null
          created_at?: string
          dados?: Json | null
          evento?: string
          id?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_status_history: {
        Row: {
          ator: string | null
          created_at: string
          id: string
          motivo: string | null
          payment_id: string
          status_anterior:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          status_novo: Database["public"]["Enums"]["status_pagamento"]
        }
        Insert: {
          ator?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          payment_id: string
          status_anterior?:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          status_novo: Database["public"]["Enums"]["status_pagamento"]
        }
        Update: {
          ator?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          payment_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          status_novo?: Database["public"]["Enums"]["status_pagamento"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_status_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          cartao_bandeira: string | null
          cartao_last4: string | null
          cliente_id: string
          codigo_transacao: string
          contrato_id: string
          created_at: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          gateway: string | null
          gateway_metadata: Json | null
          gateway_ref: string | null
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          parcelas: number | null
          pix_copia_cola: string | null
          pix_qr_code: string | null
          prestador_id: string
          status: Database["public"]["Enums"]["status_pagamento"]
          status_detail: string | null
          taxa_percentual: number
          taxa_valor: number
          updated_at: string
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          cartao_bandeira?: string | null
          cartao_last4?: string | null
          cliente_id: string
          codigo_transacao?: string
          contrato_id: string
          created_at?: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          gateway?: string | null
          gateway_metadata?: Json | null
          gateway_ref?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          prestador_id: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          status_detail?: string | null
          taxa_percentual?: number
          taxa_valor?: number
          updated_at?: string
          valor_bruto: number
          valor_liquido?: number
        }
        Update: {
          cartao_bandeira?: string | null
          cartao_last4?: string | null
          cliente_id?: string
          codigo_transacao?: string
          contrato_id?: string
          created_at?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          gateway?: string | null
          gateway_metadata?: Json | null
          gateway_ref?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          prestador_id?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          status_detail?: string | null
          taxa_percentual?: number
          taxa_valor?: number
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_ia: {
        Row: {
          categoria_detectada: string | null
          created_at: string
          id: string
          prestadores_encontrados: Json | null
          texto_digitado: string
          usuario_id: string | null
        }
        Insert: {
          categoria_detectada?: string | null
          created_at?: string
          id?: string
          prestadores_encontrados?: Json | null
          texto_digitado: string
          usuario_id?: string | null
        }
        Update: {
          categoria_detectada?: string | null
          created_at?: string
          id?: string
          prestadores_encontrados?: Json | null
          texto_digitado?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_ia_categoria_detectada_fkey"
            columns: ["categoria_detectada"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string
          prestador_id: string
          titulo: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url: string
          prestador_id: string
          titulo?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          prestador_id?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      prestador_categorias: {
        Row: {
          categoria_id: string
          created_at: string
          prestador_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          prestador_id: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          prestador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestador_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_categorias_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores: {
        Row: {
          anos_experiencia: number | null
          atende_domicilio: boolean
          created_at: string
          descricao_profissional: string | null
          disponivel: boolean
          id: string
          nota_media: number
          profile_id: string
          quantidade_avaliacoes: number
          raio_atendimento_km: number | null
          updated_at: string
          valor_hora: number | null
        }
        Insert: {
          anos_experiencia?: number | null
          atende_domicilio?: boolean
          created_at?: string
          descricao_profissional?: string | null
          disponivel?: boolean
          id?: string
          nota_media?: number
          profile_id: string
          quantidade_avaliacoes?: number
          raio_atendimento_km?: number | null
          updated_at?: string
          valor_hora?: number | null
        }
        Update: {
          anos_experiencia?: number | null
          atende_domicilio?: boolean
          created_at?: string
          descricao_profissional?: string | null
          disponivel?: boolean
          id?: string
          nota_media?: number
          profile_id?: string
          quantidade_avaliacoes?: number
          raio_atendimento_km?: number | null
          updated_at?: string
          valor_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prestadores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cidade: string | null
          created_at: string
          descricao: string | null
          email: string | null
          estado: string | null
          foto_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          telefone: string | null
          tipo_usuario: Database["public"]["Enums"]["tipo_usuario"]
          updated_at: string
          verificado: boolean
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          estado?: string | null
          foto_url?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          telefone?: string | null
          tipo_usuario?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          verificado?: boolean
        }
        Update: {
          cidade?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          telefone?: string | null
          tipo_usuario?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          verificado?: boolean
        }
        Relationships: []
      }
      propostas: {
        Row: {
          created_at: string
          id: string
          mensagem: string | null
          prazo_dias: number | null
          prestador_id: string
          solicitacao_id: string
          status: Database["public"]["Enums"]["status_proposta"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem?: string | null
          prazo_dias?: number | null
          prestador_id: string
          solicitacao_id: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string | null
          prazo_dias?: number | null
          prestador_id?: string
          solicitacao_id?: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          categoria_id: string | null
          cidade: string | null
          cliente_id: string
          created_at: string
          data_servico: string | null
          descricao: string | null
          endereco: string | null
          estado: string | null
          fotos: string[] | null
          id: string
          latitude: number | null
          longitude: number | null
          prestador_alvo_id: string | null
          status: Database["public"]["Enums"]["status_solicitacao"]
          titulo: string
          updated_at: string
          urgencia: Database["public"]["Enums"]["urgencia"]
          valor_estimado: number | null
        }
        Insert: {
          categoria_id?: string | null
          cidade?: string | null
          cliente_id: string
          created_at?: string
          data_servico?: string | null
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          fotos?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prestador_alvo_id?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          titulo: string
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia"]
          valor_estimado?: number | null
        }
        Update: {
          categoria_id?: string | null
          cidade?: string | null
          cliente_id?: string
          created_at?: string
          data_servico?: string | null
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          fotos?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          prestador_alvo_id?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao"]
          titulo?: string
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia"]
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_prestador_alvo_id_fkey"
            columns: ["prestador_alvo_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          payment_id: string | null
          prestador_id: string
          saldo_apos: number
          tipo: Database["public"]["Enums"]["tipo_transacao_carteira"]
          valor: number
          wallet_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          payment_id?: string | null
          prestador_id: string
          saldo_apos: number
          tipo: Database["public"]["Enums"]["tipo_transacao_carteira"]
          valor: number
          wallet_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          payment_id?: string | null
          prestador_id?: string
          saldo_apos?: number
          tipo?: Database["public"]["Enums"]["tipo_transacao_carteira"]
          valor?: number
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          prestador_id: string
          saldo_disponivel: number
          saldo_pendente: number
          total_recebido: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          prestador_id: string
          saldo_disponivel?: number
          saldo_pendente?: number
          total_recebido?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          prestador_id?: string
          saldo_disponivel?: number
          saldo_pendente?: number
          total_recebido?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: true
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      avaliacoes_publicas: {
        Row: {
          cliente_id: string | null
          contrato_id: string | null
          created_at: string | null
          id: string | null
          nota: number | null
          prestador_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          id?: string | null
          nota?: number | null
          prestador_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          id?: string | null
          nota?: number | null
          prestador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cliente_profile_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _creditar_carteira: {
        Args: {
          _descricao: string
          _payment_id: string
          _prestador_id: string
          _valor: number
        }
        Returns: undefined
      }
      _finalizar_dinheiro_se_completo: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      _garantir_wallet: { Args: { _prestador_id: string }; Returns: string }
      _registrar_status_pagamento: {
        Args: {
          _motivo: string
          _novo: Database["public"]["Enums"]["status_pagamento"]
          _payment_id: string
        }
        Returns: undefined
      }
      abrir_disputa: {
        Args: { _contrato_id: string; _motivo: string }
        Returns: undefined
      }
      concluir_servico: { Args: { _contrato_id: string }; Returns: undefined }
      confirmar_conclusao_cliente: {
        Args: { _contrato_id: string }
        Returns: undefined
      }
      confirmar_dinheiro_cliente: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      confirmar_dinheiro_prestador: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      confirmar_pagamento_gateway: {
        Args: {
          _metadata: Json
          _mp_payment_id: string
          _payment_id: string
          _status_detail: string
        }
        Returns: undefined
      }
      confirmar_pagamento_mock: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      criar_notificacao: {
        Args: {
          _link: string
          _msg: string
          _tipo: string
          _titulo: string
          _usuario: string
        }
        Returns: undefined
      }
      get_prestador_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      iniciar_pagamento: {
        Args: {
          _contrato_id: string
          _forma: Database["public"]["Enums"]["forma_pagamento"]
          _parcelas?: number
        }
        Returns: string
      }
      is_prestador: { Args: { _user_id: string }; Returns: boolean }
      prestador_tem_proposta: {
        Args: { _solicitacao_id: string; _user_id: string }
        Returns: boolean
      }
      registrar_gateway_ids: {
        Args: {
          _metadata: Json
          _mp_payment_id: string
          _mp_preference_id: string
          _payment_id: string
          _pix_copia_cola: string
          _pix_qr_code: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderador" | "usuario"
      forma_pagamento: "pix" | "credito" | "debito" | "dinheiro"
      status_contrato:
        | "ativo"
        | "concluido"
        | "cancelado"
        | "em_andamento"
        | "aguardando_confirmacao_cliente"
        | "aguardando_pagamento"
        | "pago"
        | "disputado"
      status_documento: "pendente" | "aprovado" | "recusado"
      status_pagamento:
        | "aguardando_pagamento"
        | "pendente"
        | "aprovado"
        | "recusado"
        | "dinheiro_pendente"
        | "concluido"
        | "em_analise"
        | "estornado"
        | "cancelado"
      status_proposta: "enviada" | "aceita" | "recusada" | "cancelada"
      status_solicitacao:
        | "aberto"
        | "recebendo_propostas"
        | "aceito"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      tipo_transacao_carteira:
        | "credito"
        | "debito"
        | "saque"
        | "estorno"
        | "ajuste"
      tipo_usuario: "cliente" | "prestador"
      urgencia: "baixa" | "media" | "alta"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderador", "usuario"],
      forma_pagamento: ["pix", "credito", "debito", "dinheiro"],
      status_contrato: [
        "ativo",
        "concluido",
        "cancelado",
        "em_andamento",
        "aguardando_confirmacao_cliente",
        "aguardando_pagamento",
        "pago",
        "disputado",
      ],
      status_documento: ["pendente", "aprovado", "recusado"],
      status_pagamento: [
        "aguardando_pagamento",
        "pendente",
        "aprovado",
        "recusado",
        "dinheiro_pendente",
        "concluido",
        "em_analise",
        "estornado",
        "cancelado",
      ],
      status_proposta: ["enviada", "aceita", "recusada", "cancelada"],
      status_solicitacao: [
        "aberto",
        "recebendo_propostas",
        "aceito",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      tipo_transacao_carteira: [
        "credito",
        "debito",
        "saque",
        "estorno",
        "ajuste",
      ],
      tipo_usuario: ["cliente", "prestador"],
      urgencia: ["baixa", "media", "alta"],
    },
  },
} as const
