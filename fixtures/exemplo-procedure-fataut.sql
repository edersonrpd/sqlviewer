DELIMITER $$

USE `AUTCOM`$$

DROP PROCEDURE IF EXISTS `esp_InserePedidosFATAUT`$$

CREATE DEFINER=`dbacitel`@`localhost` PROCEDURE `esp_InserePedidosFATAUT`()
BEGIN

DECLARE vQTD_TOLERANCIA INT DEFAULT 2; /* REQ:445754 */ 

#=======================================================================================================================
# GRAVA A LOG_ROTNOT
#=======================================================================================================================
DECLARE CONTINUE HANDLER FOR SQLEXCEPTION 
 BEGIN
  GET DIAGNOSTICS CONDITION 1
  @R_SQLSTATE = RETURNED_SQLSTATE, @M_TEXT = MESSAGE_TEXT;    
   
  INSERT INTO LOG_ROTNOT VALUES (CONCAT(@R_SQLSTATE,'-', @M_TEXT, '-', @LOCAL_PROC,' ',@PONTO_PROC), CURRENT_DATE, CURRENT_TIME );
  UPDATE LOGNOT SET LOG_HORFIN = NOW(), LOG_EXECUT = 'N' WHERE LOG_DESCRI = 'esp_InserePedidosFATAUT' AND LOG_HORINI = @HORLOG;	
  SET @ERROR = 'S';
 END;


#=======================================================================================================================
SET @ERROR ='N';
SET @LOCAL_PROC ='esp_InserePedidosFATAUT';
SET @PONTO_PROC = '';
#=======================================================================================================================
# GRAVA A LOGNOT
#=======================================================================================================================
SET @HORLOG = NOW();

INSERT INTO LOGNOT( LOG_DESCRI, LOG_VERSAO, LOG_HORINI ) VALUES( 'esp_InserePedidosFATAUT', '1.0', @HORLOG );
#=======================================================================================================================
SELECT GET_LOCK('esp_InserePedidosFATAUT', 30);
#=======================================================================================================================

        #-------------------------------------------------------------------------------
	DROP TABLE IF EXISTS TMP_FGO_ROBO;
        SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; # RONALDO

	CREATE TABLE TMP_FGO_ROBO

	SELECT 
	  AUTO_FATGOR,
	  FGO_NUMDOC,
	  FGO_ESPDOC,
	  FGO_CODEMP,
	  FGO_CODCLI,
	  FGO_CODVEN,
	  FGO_VOLUME,
	  FGO_DTAENT,
	  FDO_CODITE,
	  FGO_NUMPOK,
	  FGO_PEDSIT,
	  FDO_NUMLOT,
	  CASE
	  WHEN GMT_CODITE IS NOT NULL AND VALIDA_SALDOS_DISP_SUBITEM = 1
	   THEN 'S'
	  WHEN GMT_CODITE IS NULL
	    THEN
	        IF ( SUM(SALDO_DISPONIVEL) >= (FDO_QTDITE + vQTD_TOLERANCIA), 'S', 'N' )
	   ELSE
	        'N'
	  END ATENDE,
	  SUM(SALDO_DISPONIVEL_ESTRUTURA) AS SALDO_DISPONIVEL_ESTRUTURA,
	  SUM(SALDO_DISPONIVEL) AS SALDO_DISPONIVEL
	FROM (
	  
			
		SELECT
		  FATGOR.AUTOINCREM AS AUTO_FATGOR,
		  FATDOR.AUTOINCREM AS AUTO_FATDOR,
		  FGO_NUMDOC,
		  FGO_ESPDOC,
		  FGO_CODEMP,
		  EMP_CODEMP,
		  FGO_CODCLI,
		  FGO_CODVEN,
		  FGO_VOLUME,
		  FGO_DTAENT,
		  FDO_CODITE,
		  FGO_NUMPOK,
		  FGO_PEDSIT,
		  FDO_NUMLOT,
		  FDO_QTDITE,
		  GMT_CODITE,
		  fSaldoDispEstrutura( FDO_CODITE, EMP_CODEMP, ( FDO_QTDITE + vQTD_TOLERANCIA ) ) VALIDA_SALDOS_DISP_SUBITEM, /* REQ:445754 - GARANTE QUE TODOS SUBITE TENHAM SALDO DISPONIVEL */
		  ( fSaldoDisponivelEmpresa( DMT_ITESUB, EMP_CODEMP ) / DMT_QTDITE ) SALDO_DISPONIVEL_ESTRUTURA,
		  fSaldoDisponivelEmpresa( FDO_CODITE, EMP_CODEMP ) SALDO_DISPONIVEL
		FROM
		  FATGOR
		  INNER JOIN FATDOR ON FATGOR.AUTOINCREM = FDO_SEQGER
		  INNER JOIN EXTGOR ON FATGOR.AUTOINCREM = EXTGOR.FGO_SEQFGO
		  INNER JOIN CADCLI ON FATGOR.FGO_CODCLI = CLI_CODCLI
		  INNER JOIN CADEMP ON EMP_CODEMP IN ('001','003','034','050')
		  LEFT JOIN FATDOR_LIBEXT_LOG ON FATDOR.AUTOINCREM = FATDOR_LIBEXT_LOG.LOG_FDOAUT	/*REQUISITO 381416*/
		  LEFT JOIN GERMAT ON GMT_CODITE = FDO_CODITE                                       /* REQ:445754 */
		  LEFT JOIN DETMAT ON DMT_SEQGER = GERMAT.AUTOINCREM                                /* REQ:445754 */
		WHERE TRUE
		  AND ( FATDOR_LIBEXT_LOG.LOG_FDOAUT IS NOT NULL OR FATGOR.FGO_NUMPOK LIKE 'WS_%')	/*REQUISITO 381416*/
		  AND FGO_EMPEXP IN ('001','003','034','050')
		  AND FGO_DTAENT >='2023-05-30'
		  AND FGO_ESPDOC = 'PD'
		  AND FGO_JAFATU = 0
		  AND IFNULL(FGO_NUMPOK, '') <> ''
		  AND FGO_LIBERA = 1
		  AND FGO_LIBCOM = 1
		  AND FGO_CODTRA <> '00134'
		  # AND IF( FGO_ESTADO <> 'SP' AND CLI_CGCCPF = 1, FALSE, TRUE )
		  AND FGO_CODVEN IN (  '096' , '559' , '560' , '561' , '562' , '569' , '570' , '571' , '578' , '580', '564'  )
		--   AND ( IF( FGO_CODVEN IN (  '569', '580' ), FGO_PESBRU < 46, IF( FGO_CODVEN IN (  '559', '560', '561', '570', '571', '578' ), FGO_PESBRU < 30, TRUE ) ) )	# REGRA DE PESO DE ITEM POR VENDEDOR REQUISITO: 291330/ REMOVIDA NO REQUISITO 341311
		  ORDER BY FATGOR.AUTOINCREM, FDO_CODITE, EMP_CODEMP
	) AS TAB
	GROUP BY AUTO_FATDOR;	
	# REGRA DE PESO DE ITEM POR VENDEDOR REQUISITO: 291330
	  
	 SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ; # RONALDO
	 
	ALTER TABLE TMP_FGO_ROBO ADD KEY (FGO_NUMDOC,FGO_ESPDOC,FGO_CODEMP);
	 
	DELETE TMP_FGO_ROBO.* 
	  FROM TMP_FGO_ROBO
	  JOIN TMP_FGO_ROBO B ON TMP_FGO_ROBO.FGO_NUMDOC = B.FGO_NUMDOC
	                     AND TMP_FGO_ROBO.FGO_ESPDOC = B.FGO_ESPDOC
	                     AND TMP_FGO_ROBO.FGO_CODEMP = B.FGO_CODEMP
	                     AND B.FDO_NUMLOT = 'A DEFINIR';	# REGRA DE RETIRAR PEDIDOS COM ITEM COM LOTE A DEFINIR REQUISITO: 291330

	/*  Removida regras de dimenções pelo Req: 425923
	
	DROP TABLE IF EXISTS TMP_FGO_ROBO_DEL;
        CREATE TABLE TMP_FGO_ROBO_DEL
	SELECT FGO_NUMDOC
	     , FGO_ESPDOC
	     , FGO_CODEMP
	     , FGO_CODVEN
	     , SUM( IFNULL( ITE_EXPALT, 0 ) ) ALT
	     , SUM( IFNULL( ITE_EXPLAR, 0 ) ) LAR
	     , SUM( IFNULL( ITE_EXPPRO, 0 ) ) PRO
	  FROM TMP_FGO_ROBO
	  JOIN DESSIT ON ITE_CODITE = FDO_CODITE
	 GROUP BY FGO_NUMDOC, FGO_ESPDOC, FGO_CODEMP
	HAVING ( IF( FGO_CODVEN IN (  '569', '580' ), ALT > 300 OR LAR > 300 OR PRO  > 300
	                                            , IF( FGO_CODVEN IN (  '559', '560', '561', '570', '571', '578' ), ALT > 110 OR LAR > 110 OR PRO  > 110, FALSE ) ) );
	
	ALTER TABLE TMP_FGO_ROBO_DEL ADD KEY (FGO_NUMDOC,FGO_ESPDOC,FGO_CODEMP); 
	 
	DELETE TMP_FGO_ROBO.* 
	  FROM TMP_FGO_ROBO
	  JOIN TMP_FGO_ROBO_DEL B ON TMP_FGO_ROBO.FGO_NUMDOC = B.FGO_NUMDOC
	                     AND TMP_FGO_ROBO.FGO_ESPDOC = B.FGO_ESPDOC
	                     AND TMP_FGO_ROBO.FGO_CODEMP = B.FGO_CODEMP;	# REGRA DE RETIRAR PEDIDOS COM DIMENSOES SUPERIORES AS PERMITIDAS POR VENDEDOR REQUISITO: 291330 
	*/

        #-------------------------------------------------------------------------------
        # SELECT * FROM TMP_FGO_ROBO;
        #-------------------------------------------------------------------------------
	DROP TABLE IF EXISTS TMP_FGO_PEDIDOS_ATENDE;
	CREATE TABLE TMP_FGO_PEDIDOS_ATENDE
	SELECT  
	  GROUP_CONCAT( DISTINCT ATENDE) ATENDE,  
	  AUTO_FATGOR,
	  FGO_NUMDOC,
	  FGO_ESPDOC,
	  FGO_CODEMP,
	  FGO_CODCLI,
	  FDO_CODITE,
	  FGO_DTAENT
	  FROM TMP_FGO_ROBO A
	  GROUP BY FGO_NUMDOC, FGO_ESPDOC, FGO_CODEMP, FGO_CODCLI
	  HAVING LOCATE('N', ATENDE) = 0; 
        #-------------------------------------------------------------------------------
	# SELECT * FROM TMP_FGO_PEDIDOS_ATENDE;
        #-------------------------------------------------------------------------------
	DROP TABLE IF EXISTS TMP_PEDIDOS_A_INSERIR;
	CREATE TABLE TMP_PEDIDOS_A_INSERIR
	SELECT DISTINCT
	 AUTO_FATGOR,
	 FGO_NUMDOC,
	 FGO_ESPDOC,
	 FGO_CODEMP
	FROM
	  TMP_FGO_PEDIDOS_ATENDE A
	  LEFT JOIN FATAUT
	    ON FGO_NUMDOC = FAT_NUMDOC
	   AND FGO_ESPDOC = FAT_ESPDOC
	   AND FGO_CODEMP = FAT_EMPDOC
	WHERE FATAUT.AUTOINCREM IS NULL ;
        #-------------------------------------------------------------------------------
	# SELECT * FROM TMP_PEDIDOS_A_INSERIR;
        #-------------------------------------------------------------------------------
	IF ( SELECT COUNT(0) FROM TMP_PEDIDOS_A_INSERIR ) > 0 THEN 

                INSERT INTO FATAUT( AUTOINCREM, FAT_NUMDOC, FAT_ESPDOC, FAT_EMPDOC, FAT_DTAINS, FAT_FDOGER ) 
		SELECT
		 fRetAutoincrem('FATAUT', FGO_CODEMP) AUTINC,
		 FGO_NUMDOC,
		 FGO_ESPDOC,
		 FGO_CODEMP,
		 NOW(),
		 AUTO_FATGOR
		FROM
		  TMP_PEDIDOS_A_INSERIR A;
        
	END IF;
        #-------------------------------------------------------------------------------

#=======================================================================================================================
SELECT RELEASE_LOCK('esp_InserePedidosFATAUT');
#=======================================================================================================================
# FECHA O ARQUIVO DE LOG
#=======================================================================================================================
IF (@ERROR = 'N') THEN

UPDATE LOGNOT SET LOG_HORFIN = NOW(), LOG_EXECUT = 'S' WHERE LOG_DESCRI = 'esp_InserePedidosFATAUT' AND 
LOG_HORINI = @HORLOG;

END IF;
#=======================================================================================================================		
  
    END$$

DELIMITER ;
